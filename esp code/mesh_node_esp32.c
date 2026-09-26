/*
 * mesh_node_esp32.c (or mesh_node_esp32.ino) -- ESP32 Dev Module (WROOM-32)
 *
 * Tactical Soldier Relay Node featuring:
 * 1. AES-128 Encrypted Ad-Hoc ESP-NOW Mesh Networking.
 * 2. Dynamic RSSI Topology Adaptation (Auto-selects best upstream relay based on link RSSI).
 * 3. Autonomous Multi-Hop Packet Forwarding with Collision-Avoidance Jitter.
 * 4. Zero-Config Gateway Beacon Discovery.
 *
 * Flash one per node, changing only NODE_ID / NODE_LAT / NODE_LON.
 * Requires Arduino-ESP32 Core 3.x.
 */

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

// Protocol definitions, packet structs & AES-128 CBC crypto
#include "mesh_proto.h"

// ============================================================================
// PER-NODE CONFIGURATION
// ============================================================================
#define NODE_ID          1
static const float NODE_LAT = 12.908100f;
static const float NODE_LON = 77.567900f;

// Mesh Configuration
static const char*    GW_AP_SSID           = "MESH-GW";
static const uint8_t  FALLBACK_CHANNEL     = 1;
static const uint8_t  MESH_TTL             = 3;
static const uint32_t TX_INTERVAL_MS       = 4000;
static const uint32_t RESCAN_INTERVAL_MS   = 45000;
static const uint32_t RELAY_JITTER_MAX_MS  = 35;
static const int8_t   DIRECT_GW_THRESH_DBM = -75;

// ============================================================================
// GLOBAL STATE & DATA STRUCTURES
// ============================================================================
static const uint8_t BCAST_MAC[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

static uint8_t  meshChannel = FALLBACK_CHANNEL;
static int8_t   rssiToGw    = -128;
static uint16_t txSeq       = 0;

// Dynamic Neighbor RSSI Table for Ad-Hoc Routing
typedef struct {
  uint8_t  nodeId;
  int8_t   rssi;
  uint8_t  hops;
  uint32_t lastSeenMs;
} NeighborLink;

#define MAX_NEIGHBORS 8
static NeighborLink neighbors[MAX_NEIGHBORS];
static portMUX_TYPE neighborMux = portMUX_INITIALIZER_UNLOCKED;

// Deduplication Cache
#define SEEN_LEN 32
typedef struct { uint8_t id; uint16_t seq; bool used; } SeenEntry;
static SeenEntry    seen[SEEN_LEN];
static uint8_t      seenIdx = 0;
static portMUX_TYPE seenMux = portMUX_INITIALIZER_UNLOCKED;

// Outgoing Relay Queue
#define RELAY_QUEUE_LEN 12
static MeshPacket       relayq[RELAY_QUEUE_LEN];
static volatile uint8_t relayHead = 0;
static volatile uint8_t relayTail = 0;
static portMUX_TYPE     relayMux  = portMUX_INITIALIZER_UNLOCKED;

// ============================================================================
// DYNAMIC TOPOLOGY ADAPTATION (Neighbor RSSI Tracking)
// ============================================================================
static void updateNeighborLink(uint8_t srcId, int8_t rssi, uint8_t hops) {
  if (srcId == NODE_ID || srcId == 0) return;

  portENTER_CRITICAL(&neighborMux);
  int emptyIdx = -1;
  bool updated = false;

  for (int i = 0; i < MAX_NEIGHBORS; i++) {
    if (neighbors[i].nodeId == srcId) {
      neighbors[i].rssi       = rssi;
      neighbors[i].hops       = hops;
      neighbors[i].lastSeenMs = millis();
      updated = true;
      break;
    }
    if (neighbors[i].nodeId == 0 && emptyIdx == -1) emptyIdx = i;
  }

  if (!updated && emptyIdx != -1) {
    neighbors[emptyIdx].nodeId     = srcId;
    neighbors[emptyIdx].rssi       = rssi;
    neighbors[emptyIdx].hops       = hops;
    neighbors[emptyIdx].lastSeenMs = millis();
  }
  portEXIT_CRITICAL(&neighborMux);
}

static void determineBestUpstreamLink(uint8_t* outRelayId, int8_t* outLinkRssi) {
  uint32_t now = millis();
  uint8_t bestId = 0;
  int8_t  bestRssi = -128;

  // If direct link to gateway is strong, route directly to gateway (0)
  if (rssiToGw > DIRECT_GW_THRESH_DBM) {
    *outRelayId  = 0;
    *outLinkRssi = rssiToGw;
    return;
  }

  // Otherwise, inspect ad-hoc neighbors to select best relay node
  portENTER_CRITICAL(&neighborMux);
  for (int i = 0; i < MAX_NEIGHBORS; i++) {
    if (neighbors[i].nodeId != 0 && (now - neighbors[i].lastSeenMs < 30000)) {
      if (neighbors[i].rssi > bestRssi) {
        bestRssi = neighbors[i].rssi;
        bestId   = neighbors[i].nodeId;
      }
    }
  }
  portEXIT_CRITICAL(&neighborMux);

  if (bestId != 0 && bestRssi > rssiToGw) {
    *outRelayId  = bestId;
    *outLinkRssi = bestRssi;
  } else {
    *outRelayId  = 0;
    *outLinkRssi = rssiToGw;
  }
}

// ============================================================================
// DEDUPLICATION & RELAY QUEUE
// ============================================================================
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

static void onEspNowRecv(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  if (len != (int)sizeof(MeshPacket)) return;

  // Decrypt incoming payload with AES-128-CBC
  MeshPacket p;
  if (!decryptMeshPacket(data, len, &p)) {
    Serial.println("[crypto] Decryption error, rejecting packet");
    return;
  }

  int8_t directRssi = (info && info->rx_ctrl) ? (int8_t)info->rx_ctrl->rssi : -128;
  updateNeighborLink(p.srcId, directRssi, p.hops);

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

// ============================================================================
// GATEWAY DISCOVERY
// ============================================================================
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
  if (!found) found = scanForGateway(0, &ch, &rssi);

  if (found) {
    meshChannel = ch;
    rssiToGw    = rssi;
    Serial.printf("[mesh] Gateway found on ch%u, RSSI %d dBm\n", meshChannel, rssiToGw);
  } else {
    rssiToGw = -128;
    Serial.printf("[mesh] Gateway unreachable, maintaining Ch%u\n", meshChannel);
  }

  esp_wifi_set_channel(meshChannel, WIFI_SECOND_CHAN_NONE);
}

// ============================================================================
// TRANSMISSION & TELEMETRY
// ============================================================================
static bool addBroadcastPeer() {
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, BCAST_MAC, 6);
  peer.channel = 0;
  peer.encrypt = false;
  peer.ifidx   = WIFI_IF_STA;

  if (esp_now_is_peer_exist(BCAST_MAC)) esp_now_del_peer(BCAST_MAC);
  esp_err_t e = esp_now_add_peer(&peer);
  return (e == ESP_OK);
}

static void sendTelemetry() {
  MeshPacket p = {};
  p.magic    = MESH_MAGIC;
  p.ver      = MESH_VER;
  p.srcId    = NODE_ID;
  p.ttl      = MESH_TTL;
  p.hops     = 0;
  p.seq      = ++txSeq;
  p.lat      = NODE_LAT;
  p.lon      = NODE_LON;
  p.rssiNode = rssiToGw;
  p.antenna  = 0;            // Standard omni
  p.hasVideo = 0;

  determineBestUpstreamLink(&p.bestRelayId, &p.linkRssi);
  markSeen(NODE_ID, p.seq);

  uint8_t cipherBuf[sizeof(MeshPacket)];
  if (!encryptMeshPacket(&p, cipherBuf)) {
    Serial.println("[crypto] Encryption failed");
    return;
  }

  esp_err_t e = esp_now_send(BCAST_MAC, cipherBuf, sizeof(cipherBuf));
  if (e == ESP_OK) {
    Serial.printf("[tx] Node-%u seq=%u rssiGw=%d bestRelay=%u (linkRssi=%d)\n",
                  p.srcId, p.seq, p.rssiNode, p.bestRelayId, p.linkRssi);
  } else {
    Serial.printf("[tx] Send error: %d\n", e);
  }
}

// ============================================================================
// SETUP & MAIN LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("\n[node-esp32] Booting Relay Node ID=%u (Lat=%.6f, Lon=%.6f)\n",
                NODE_ID, NODE_LAT, NODE_LON);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(false, true);
  WiFi.setSleep(false);

  refreshGatewayLink();

  if (esp_now_init() != ESP_OK) {
    Serial.println("[espnow] Init failed, restarting...");
    delay(2000);
    ESP.restart();
  }
  esp_now_register_recv_cb(onEspNowRecv);
  addBroadcastPeer();

  Serial.printf("[mesh] Encrypted AES-128 Relay active on Ch%u\n", meshChannel);
}

void loop() {
  static uint32_t lastTx     = 0;
  static uint32_t lastRescan = 0;

  // Forward relayed packets with random jitter to prevent collisions
  MeshPacket fwd;
  while (relayPop(&fwd)) {
    delay(random(0, RELAY_JITTER_MAX_MS));
    uint8_t cipherBuf[sizeof(MeshPacket)];
    if (encryptMeshPacket(&fwd, cipherBuf)) {
      esp_now_send(BCAST_MAC, cipherBuf, sizeof(cipherBuf));
      Serial.printf("[relay] Node-%u seq=%u hops=%u ttl=%u\n",
                    fwd.srcId, fwd.seq, fwd.hops, fwd.ttl);
    }
  }

  // Periodic Gateway Beacon Rescan
  if (millis() - lastRescan >= RESCAN_INTERVAL_MS) {
    lastRescan = millis();
    refreshGatewayLink();
    addBroadcastPeer();
  }

  // Periodic Telemetry Transmission
  if (millis() - lastTx >= TX_INTERVAL_MS) {
    lastTx = millis();
    sendTelemetry();
  }
}
