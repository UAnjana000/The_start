/*
 * mesh_node_esp32.ino  --  ESP32 dev module (WROOM-32)
 *
 * ESP-NOW ad hoc node. Broadcasts its own telemetry and relays anyone else's,
 * so a node out of gateway range still gets through: N3 -> N2 -> N1 -> GW.
 *
 * No AS179 fitted on this board, so antenna is reported as 0.
 *
 * Flash one per node, changing only NODE_ID / NODE_LAT / NODE_LON.
 * Requires Arduino-ESP32 core 3.x.
 */

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

// MeshPacket lives here. It must NOT be declared in the .ino: the Arduino
// preprocessor injects generated function prototypes above any typedef in the
// sketch, which breaks relayPop().
#include "mesh_proto.h"

// ------------------------------------------------------ per-node config ---
// The only three lines you change between nodes.

#define NODE_ID 1
static const float NODE_LAT = 12.908100f;
static const float NODE_LON = 77.567900f;

// ---------------------------------------------------------- mesh config ---

static const char*    GW_AP_SSID        = "MESH-GW";   // must match gateway
static const uint8_t  FALLBACK_CHANNEL  = 1;           // used until we find the gw
static const uint8_t  MESH_TTL          = 3;           // max relay hops
static const uint32_t TX_INTERVAL_MS    = 5000;
static const uint32_t RESCAN_INTERVAL_MS = 60000;      // refresh channel + rssi
static const uint32_t RELAY_JITTER_MAX_MS = 40;        // avoids relay collisions

// ----------------------------------------------------------------- state ---

static const uint8_t BCAST[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

static uint8_t  meshChannel = FALLBACK_CHANNEL;
static int8_t   rssiToGw    = -128;   // -128 = gateway not visible
static uint16_t txSeq       = 0;

// Relay dedup cache. Small on purpose: a node only needs to remember long
// enough to not echo the same broadcast back into the air.
#define SEEN_LEN 32
typedef struct { uint8_t id; uint16_t seq; bool used; } Seen;
static Seen         seen[SEEN_LEN];
static uint8_t      seenIdx = 0;
static portMUX_TYPE seenMux = portMUX_INITIALIZER_UNLOCKED;   // rx task vs loop

// Relay queue. esp_now_send() must not be called from inside the recv
// callback, so packets to forward are parked here for loop().
#define RELAY_QUEUE_LEN 12
static MeshPacket       relayq[RELAY_QUEUE_LEN];
static volatile uint8_t relayHead = 0;
static volatile uint8_t relayTail = 0;
static portMUX_TYPE     relayMux  = portMUX_INITIALIZER_UNLOCKED;

// ------------------------------------------------------------- dedup ------

static bool markSeen(uint8_t id, uint16_t seq) {
  bool hit = false;

  portENTER_CRITICAL(&seenMux);
  for (uint8_t i = 0; i < SEEN_LEN; i++) {
    if (seen[i].used && seen[i].id == id && seen[i].seq == seq) { hit = true; break; }
  }
  if (!hit) {
    seen[seenIdx] = { id, seq, true };
    seenIdx       = (uint8_t)((seenIdx + 1) % SEEN_LEN);
  }
  portEXIT_CRITICAL(&seenMux);

  return hit;
}

// --------------------------------------------------------- espnow rx ------

static void onEspNowRecv(const esp_now_recv_info_t* info,
                         const uint8_t* data, int len) {
  if (len != (int)sizeof(MeshPacket)) return;

  MeshPacket p;
  memcpy(&p, data, sizeof(p));
  if (p.magic != MESH_MAGIC || p.ver != MESH_VER) return;
  if (p.srcId == NODE_ID) return;            // our own packet coming back
  if (markSeen(p.srcId, p.seq)) return;      // already relayed this one
  if (p.ttl <= 1) return;                    // hop budget spent

  p.ttl--;
  p.hops++;

  portENTER_CRITICAL(&relayMux);
  uint8_t next = (uint8_t)((relayHead + 1) % RELAY_QUEUE_LEN);
  if (next != relayTail) {
    relayq[relayHead] = p;
    relayHead         = next;
  }
  portEXIT_CRITICAL(&relayMux);
}

static bool relayPop(MeshPacket* out) {
  bool got = false;
  portENTER_CRITICAL(&relayMux);
  if (relayTail != relayHead) {
    *out      = relayq[relayTail];
    relayTail = (uint8_t)((relayTail + 1) % RELAY_QUEUE_LEN);
    got       = true;
  }
  portEXIT_CRITICAL(&relayMux);
  return got;
}

// ------------------------------------------------- gateway discovery ------

/*
 * Scan for the gateway's beacon. Gives us two things at once: the channel
 * ESP-NOW has to run on, and this node's real RSSI toward the gateway.
 *
 * onChannel 0 scans everything (slow, ~2s). Once we know the channel we scan
 * only that one, which is a few hundred ms.
 */
static bool scanForGateway(uint8_t onChannel, uint8_t* chOut, int8_t* rssiOut) {
  int n = WiFi.scanNetworks(false, true, false, 150, onChannel);
  bool found = false;

  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == GW_AP_SSID) {
      *chOut   = (uint8_t)WiFi.channel(i);
      *rssiOut = (int8_t)WiFi.RSSI(i);
      found    = true;
      break;
    }
  }

  WiFi.scanDelete();
  return found;
}

static void refreshGatewayLink() {
  uint8_t ch   = meshChannel;
  int8_t  rssi = -128;

  bool found = scanForGateway(meshChannel, &ch, &rssi);
  if (!found) found = scanForGateway(0, &ch, &rssi);   // fall back to full scan

  if (found) {
    meshChannel = ch;
    rssiToGw    = rssi;
    Serial.printf("[mesh] gateway on ch%u, rssi %d\n", meshChannel, rssiToGw);
  } else {
    rssiToGw = -128;
    Serial.printf("[mesh] gateway not visible, holding ch%u\n", meshChannel);
  }

  // Scanning hops channels, so put the radio back where ESP-NOW expects it.
  esp_wifi_set_channel(meshChannel, WIFI_SECOND_CHAN_NONE);
}

// ------------------------------------------------------------- espnow tx --

static bool addBroadcastPeer() {
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, BCAST, 6);
  peer.channel = 0;        // 0 = whatever channel the interface is on
  peer.encrypt = false;
  peer.ifidx   = WIFI_IF_STA;

  if (esp_now_is_peer_exist(BCAST)) esp_now_del_peer(BCAST);
  esp_err_t e = esp_now_add_peer(&peer);
  if (e != ESP_OK) Serial.printf("[espnow] add_peer failed: %d\n", e);
  return e == ESP_OK;
}

static void sendTelemetry() {
  MeshPacket p = {};
  p.magic    = MESH_MAGIC;
  p.ver      = MESH_VER;
  p.srcId    = NODE_ID;
  p.ttl      = MESH_TTL;
  p.seq      = ++txSeq;
  p.lat      = NODE_LAT;
  p.lon      = NODE_LON;
  p.rssiNode = rssiToGw;
  p.antenna  = 0;          // no AS179 on this board
  p.hops     = 0;

  markSeen(NODE_ID, p.seq);   // so a relayed echo does not loop back through us

  esp_err_t e = esp_now_send(BCAST, (uint8_t*)&p, sizeof(p));
  if (e == ESP_OK) {
    Serial.printf("[tx] seq=%u rssiNode=%d\n", p.seq, p.rssiNode);
  } else {
    Serial.printf("[tx] failed: %d\n", e);
  }
}

// ---------------------------------------------------------------- setup ---

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("\n[node] id=%u lat=%.6f lon=%.6f\n", NODE_ID, NODE_LAT, NODE_LON);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(false, true);   // never associate, ESP-NOW only
  WiFi.setSleep(false);

  refreshGatewayLink();

  if (esp_now_init() != ESP_OK) {
    Serial.println("[espnow] init failed, restarting");
    delay(2000);
    ESP.restart();
  }
  esp_now_register_recv_cb(onEspNowRecv);
  addBroadcastPeer();

  Serial.printf("[espnow] up on ch%u\n", meshChannel);
}

// ----------------------------------------------------------------- loop ---

void loop() {
  static uint32_t lastTx     = 0;
  static uint32_t lastRescan = 0;

  MeshPacket fwd;
  while (relayPop(&fwd)) {
    delay(random(0, RELAY_JITTER_MAX_MS));
    esp_now_send(BCAST, (uint8_t*)&fwd, sizeof(fwd));
    Serial.printf("[relay] node-%u seq=%u hops=%u ttl=%u\n",
                  fwd.srcId, fwd.seq, fwd.hops, fwd.ttl);
  }

  if (millis() - lastRescan >= RESCAN_INTERVAL_MS) {
    lastRescan = millis();
    refreshGatewayLink();
    addBroadcastPeer();   // peer channel tracking after a channel change
  }

  if (millis() - lastTx >= TX_INTERVAL_MS) {
    lastTx = millis();
    sendTelemetry();
  }
}
