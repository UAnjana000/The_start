/*
 * mesh_node_c6.ino  --  Seeed XIAO ESP32C6 (helmet node)
 *
 * Same ad hoc ESP-NOW node as mesh_node_esp32, plus RSSI-based antenna
 * diversity across an external AS179-92LF SPDT hanging off the u.FL port.
 *
 * RF path on this board is two switches in series:
 *
 *   C6 radio -> on-board Seeed switch -> u.FL -> your AS179 -> ant 1 / ant 2
 *                    (GPIO3 / GPIO14)          (V1 / V2)
 *
 * The on-board switch defaults to the ceramic chip antenna. If you do not
 * flip it to the u.FL side, your AS179 spends its life switching a dead trace.
 * routeToExternalUfl() below is what stops that happening.
 *
 * Board: Seeed XIAO ESP32C6. Requires Arduino-ESP32 core 3.x.
 */

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

// MeshPacket lives here. It must NOT be declared in the .ino: the Arduino
// preprocessor injects generated function prototypes above any typedef in the
// sketch, which breaks relayPop().
#include "mesh_proto.h"

// ------------------------------------------------------ per-node config ---

#define NODE_ID 3
static const float NODE_LAT = 12.907200f;
static const float NODE_LON = 77.566300f;

// ----------------------------------------------------------- rf hardware --

// Seeed's on-board RF switch. Not optional.
#define XIAO_RF_EN_PIN    3     // LOW enables the switch
#define XIAO_ANT_SEL_PIN  14    // HIGH routes RF to the external u.FL

/*
 * AS179 control lines.
 *
 * These are the pads silkscreened D4 and D5 on a XIAO ESP32C6, which are
 * GPIO22 and GPIO23. Raw GPIO4 / GPIO5 are not bonded out on this board.
 * If you are on a bare ESP32-C6-DevKitC instead, change these to 4 and 5.
 */
#define AS179_V1_PIN  22
#define AS179_V2_PIN  23

static const uint16_t AS179_SETTLE_MS   = 5;   // switch is ns-fast, radio is not
static const int8_t   ANT_HYSTERESIS_DB = 4;   // stops the antenna flapping

// ---------------------------------------------------------- mesh config ---

static const char*    GW_AP_SSID          = "MESH-GW";
static const uint8_t  FALLBACK_CHANNEL    = 1;
static const uint8_t  MESH_TTL            = 3;
static const uint32_t TX_INTERVAL_MS      = 5000;
static const uint32_t ANT_EVAL_INTERVAL_MS = 60000;
static const uint32_t RELAY_JITTER_MAX_MS = 40;

// ----------------------------------------------------------------- state ---

static const uint8_t BCAST[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

static uint8_t  meshChannel   = FALLBACK_CHANNEL;
static int8_t   rssiToGw      = -128;
static uint8_t  activeAntenna = 1;
static uint16_t txSeq         = 0;

#define SEEN_LEN 32
typedef struct { uint8_t id; uint16_t seq; bool used; } Seen;
static Seen         seen[SEEN_LEN];
static uint8_t      seenIdx = 0;
static portMUX_TYPE seenMux = portMUX_INITIALIZER_UNLOCKED;   // rx task vs loop

#define RELAY_QUEUE_LEN 12
static MeshPacket       relayq[RELAY_QUEUE_LEN];
static volatile uint8_t relayHead = 0;
static volatile uint8_t relayTail = 0;
static portMUX_TYPE     relayMux  = portMUX_INITIALIZER_UNLOCKED;

// -------------------------------------------------------- antenna control --

static void routeToExternalUfl() {
  pinMode(XIAO_RF_EN_PIN, OUTPUT);
  digitalWrite(XIAO_RF_EN_PIN, LOW);
  delay(100);
  pinMode(XIAO_ANT_SEL_PIN, OUTPUT);
  digitalWrite(XIAO_ANT_SEL_PIN, HIGH);
  delay(100);
  Serial.println("[rf] on-board switch -> external u.FL");
}

/*
 * AS179 truth table: V1 and V2 must be complementary. Both LOW puts the part
 * in isolation on every path, which looks exactly like a broken antenna.
 */
static void selectAntenna(uint8_t a) {
  if (a == 1) {
    digitalWrite(AS179_V1_PIN, HIGH);
    digitalWrite(AS179_V2_PIN, LOW);
  } else {
    digitalWrite(AS179_V1_PIN, LOW);
    digitalWrite(AS179_V2_PIN, HIGH);
  }
  activeAntenna = a;
  delay(AS179_SETTLE_MS);
}

static void antennaInit() {
  pinMode(AS179_V1_PIN, OUTPUT);
  pinMode(AS179_V2_PIN, OUTPUT);
  selectAntenna(1);
}

// ------------------------------------------------- gateway discovery ------

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

/*
 * Measure the gateway beacon on each antenna in turn and keep the better one.
 *
 * This is why the transport is ESP-NOW and not a TCP mesh: there is no
 * association to lose when the RF path is cut mid-measurement. Cost is roughly
 * 300ms of deafness per antenna, once a minute.
 */
static void evaluateAntennas() {
  uint8_t ch1 = meshChannel, ch2 = meshChannel;
  int8_t  r1  = -128,        r2  = -128;

  selectAntenna(1);
  bool f1 = scanForGateway(meshChannel, &ch1, &r1);
  if (!f1) f1 = scanForGateway(0, &ch1, &r1);

  selectAntenna(2);
  bool f2 = scanForGateway(meshChannel, &ch2, &r2);
  if (!f2) f2 = scanForGateway(0, &ch2, &r2);

  if (!f1 && !f2) {
    rssiToGw = -128;
    selectAntenna(activeAntenna);
    esp_wifi_set_channel(meshChannel, WIFI_SECOND_CHAN_NONE);
    Serial.printf("[ant] gateway invisible on both, holding ant%u ch%u\n",
                  activeAntenna, meshChannel);
    return;
  }

  uint8_t best = activeAntenna;
  if (r1 >= r2 + ANT_HYSTERESIS_DB)      best = 1;
  else if (r2 >= r1 + ANT_HYSTERESIS_DB) best = 2;

  selectAntenna(best);
  meshChannel = (best == 1) ? ch1 : ch2;
  rssiToGw    = (best == 1) ? r1  : r2;

  esp_wifi_set_channel(meshChannel, WIFI_SECOND_CHAN_NONE);

  Serial.printf("[ant] ant1=%d ant2=%d -> ant%u (ch%u)\n",
                r1, r2, activeAntenna, meshChannel);
}

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
  if (p.srcId == NODE_ID) return;
  if (markSeen(p.srcId, p.seq)) return;
  if (p.ttl <= 1) return;

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

// ------------------------------------------------------------- espnow tx --

static bool addBroadcastPeer() {
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, BCAST, 6);
  peer.channel = 0;
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
  p.antenna  = activeAntenna;
  p.hops     = 0;

  markSeen(NODE_ID, p.seq);

  esp_err_t e = esp_now_send(BCAST, (uint8_t*)&p, sizeof(p));
  if (e == ESP_OK) {
    Serial.printf("[tx] seq=%u ant=%u rssiNode=%d\n",
                  p.seq, p.antenna, p.rssiNode);
  } else {
    Serial.printf("[tx] failed: %d\n", e);
  }
}

// ---------------------------------------------------------------- setup ---

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\n[node] c6 id=%u lat=%.6f lon=%.6f\n",
                NODE_ID, NODE_LAT, NODE_LON);

  routeToExternalUfl();
  antennaInit();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(false, true);
  WiFi.setSleep(false);

  evaluateAntennas();

  if (esp_now_init() != ESP_OK) {
    Serial.println("[espnow] init failed, restarting");
    delay(2000);
    ESP.restart();
  }
  esp_now_register_recv_cb(onEspNowRecv);
  addBroadcastPeer();

  Serial.printf("[espnow] up on ch%u, ant%u\n", meshChannel, activeAntenna);
}

// ----------------------------------------------------------------- loop ---

void loop() {
  static uint32_t lastTx      = 0;
  static uint32_t lastAntEval = 0;

  MeshPacket fwd;
  while (relayPop(&fwd)) {
    delay(random(0, RELAY_JITTER_MAX_MS));
    esp_now_send(BCAST, (uint8_t*)&fwd, sizeof(fwd));
    Serial.printf("[relay] node-%u seq=%u hops=%u ttl=%u\n",
                  fwd.srcId, fwd.seq, fwd.hops, fwd.ttl);
  }

  if (millis() - lastAntEval >= ANT_EVAL_INTERVAL_MS) {
    lastAntEval = millis();
    evaluateAntennas();
    addBroadcastPeer();
  }

  if (millis() - lastTx >= TX_INTERVAL_MS) {
    lastTx = millis();
    sendTelemetry();
  }
}
