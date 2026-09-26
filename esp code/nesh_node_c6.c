/*
 * nesh_node_c6.c (or mesh_node_c6.ino) -- Seeed XIAO ESP32-C6 / ESP32-CAM Helmet Node
 *
 * Tactical Soldier Helmet Node featuring:
 * 1. Dynamic RF Antenna Diversity (AS179-92LF SPDT Switch with 4 dB Hysteresis).
 * 2. High-Throughput Camera MJPEG Stream Server (/stream over local AP/mDNS).
 * 3. AES-128 Encrypted Ad-Hoc ESP-NOW MANET Mesh with dynamic RSSI link adaptation.
 * 4. Autonomous Mesh Relaying with Collision Avoidance Jitter.
 *
 * Board: Seeed XIAO ESP32C6 / ESP32-CAM. Requires Arduino-ESP32 Core 3.x.
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include "esp_http_server.h"
#include "esp_camera.h"

// Protocol definitions, packet structs & AES-128 CBC crypto
#include "mesh_proto.h"

// ============================================================================
// PER-NODE CONFIGURATION
// ============================================================================
#define NODE_ID          3
static const float NODE_LAT = 12.907200f;
static const float NODE_LON = 77.566300f;
static const char* NODE_HOSTNAME = "esp32-c6-cam";

// WiFi Credentials (for stream & discovery)
static const char* LOCAL_SSID     = "ACT-ai_102711948432";
static const char* LOCAL_PASS     = "83221436";
static const char* GW_AP_SSID     = "MESH-GW";

// Mesh Timing & Routing Constraints
static const uint8_t  FALLBACK_CHANNEL     = 1;
static const uint8_t  MESH_TTL             = 3;
static const uint32_t TX_INTERVAL_MS       = 3000;
static const uint32_t ANT_EVAL_INTERVAL_MS  = 45000;
static const uint32_t RELAY_JITTER_MAX_MS  = 35;
static const int8_t   DIRECT_GW_THRESH_DBM = -75;  // Below -75 dBm, consider relaying via neighbor

// ============================================================================
// HARDWARE PIN DEFINITIONS (Seeed XIAO ESP32-C6 & AS179-92LF RF Switch)
// ============================================================================
#define XIAO_RF_EN_PIN     3     // LOW enables on-board RF switch
#define XIAO_ANT_SEL_PIN   14    // HIGH routes RF to external u.FL
#define AS179_V1_PIN       22    // D4 (GPIO22 on XIAO C6)
#define AS179_V2_PIN       23    // D5 (GPIO23 on XIAO C6)

static const uint16_t AS179_SETTLE_MS   = 5;
static const int8_t   ANT_HYSTERESIS_DB = 4;

// ============================================================================
// CAMERA PIN CONFIGURATION (OV2640 / Standard AI-Thinker Pinout)
// ============================================================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ============================================================================
// GLOBAL STATE & DATA STRUCTURES
// ============================================================================
static const uint8_t BCAST_MAC[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

static uint8_t  meshChannel   = FALLBACK_CHANNEL;
static int8_t   rssiToGw      = -128;
static uint8_t  activeAntenna = 1;
static uint16_t txSeq         = 0;
static bool     cameraReady   = false;

// Ad-Hoc Neighbor RSSI Table for Dynamic Topology
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

httpd_handle_t stream_httpd = NULL;

// ============================================================================
// CAMERA HTTP STREAM HANDLER
// ============================================================================
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[64];

  res = httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=frameboundary");
  if (res != ESP_OK) return res;

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[cam] Frame capture failed");
      res = ESP_FAIL;
    } else {
      size_t hlen = snprintf(part_buf, sizeof(part_buf),
        "--frameboundary\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", fb->len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
      if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
      if (res == ESP_OK) res = httpd_resp_send_chunk(req, "\r\n", 2);
      esp_camera_fb_return(fb);
      if (res != ESP_OK) break;
    }
  }
  return res;
}

static void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    Serial.println("[cam] Stream server listening on :80/stream");
  }
}

static bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_siod     = SIOD_GPIO_NUM;
  config.pin_sioc     = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 10;
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[cam] Camera init failed: 0x%x\n", err);
    return false;
  }
  return true;
}

// ============================================================================
// RF ANTENNA DIVERSITY CONTROL (AS179-92LF)
// ============================================================================
static void routeToExternalUfl() {
  pinMode(XIAO_RF_EN_PIN, OUTPUT);
  digitalWrite(XIAO_RF_EN_PIN, LOW);
  delay(50);
  pinMode(XIAO_ANT_SEL_PIN, OUTPUT);
  digitalWrite(XIAO_ANT_SEL_PIN, HIGH);
  delay(50);
  Serial.println("[rf] Seeed on-board RF multiplexer -> external u.FL active");
}

static void selectAntenna(uint8_t ant) {
  if (ant == 1) {
    digitalWrite(AS179_V1_PIN, HIGH);
    digitalWrite(AS179_V2_PIN, LOW);
  } else {
    digitalWrite(AS179_V1_PIN, LOW);
    digitalWrite(AS179_V2_PIN, HIGH);
  }
  activeAntenna = ant;
  delay(AS179_SETTLE_MS);
}

static void antennaInit() {
  pinMode(AS179_V1_PIN, OUTPUT);
  pinMode(AS179_V2_PIN, OUTPUT);
  selectAntenna(1);
}

// ============================================================================
// GATEWAY BEACON & SCANNING
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
    Serial.printf("[ant] Gateway beacon unreachable on both, holding ant%u ch%u\n",
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

  Serial.printf("[ant] Dynamic Diversity: Ant1=%ddBm Ant2=%ddBm -> Active: Ant%u (Ch%u)\n",
                r1, r2, activeAntenna, meshChannel);
}

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

  // If direct link to gateway is strong, route directly to gateway (ID=0)
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
    Serial.println("[crypto] Decryption or verification failed, discarding packet");
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
  p.antenna  = activeAntenna;
  p.hasVideo = cameraReady ? 1 : 0;

  determineBestUpstreamLink(&p.bestRelayId, &p.linkRssi);
  markSeen(NODE_ID, p.seq);

  // Encrypt with AES-128
  uint8_t cipherBuf[sizeof(MeshPacket)];
  if (!encryptMeshPacket(&p, cipherBuf)) {
    Serial.println("[crypto] Encryption failed!");
    return;
  }

  esp_err_t e = esp_now_send(BCAST_MAC, cipherBuf, sizeof(cipherBuf));
  if (e == ESP_OK) {
    Serial.printf("[tx-c6] seq=%u ant=%u rssiGw=%d bestRelay=%u (linkRssi=%d) video=%d\n",
                  p.seq, p.antenna, p.rssiNode, p.bestRelayId, p.linkRssi, p.hasVideo);
  } else {
    Serial.printf("[tx-c6] Send failed: %d\n", e);
  }
}

// ============================================================================
// SETUP & MAIN LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\n[node-c6] Booting Helmet Node ID=%u (Lat=%.6f, Lon=%.6f)\n",
                NODE_ID, NODE_LAT, NODE_LON);

  routeToExternalUfl();
  antennaInit();

  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);

  // Optional: Connect to local network if available for camera streaming
  WiFi.begin(LOCAL_SSID, LOCAL_PASS);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) {
    delay(200);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] Connected, IP: %s\n", WiFi.localIP().toString().c_str());
    if (MDNS.begin(NODE_HOSTNAME)) {
      Serial.printf("[mdns] Responder http://%s.local/stream ready\n", NODE_HOSTNAME);
    }
  }

  cameraReady = initCamera();
  if (cameraReady) {
    startCameraServer();
    Serial.println("[cam] Helmet live camera feed activated");
  }

  evaluateAntennas();

  if (esp_now_init() != ESP_OK) {
    Serial.println("[espnow] Init failed, rebooting...");
    delay(2000);
    ESP.restart();
  }
  esp_now_register_recv_cb(onEspNowRecv);
  addBroadcastPeer();

  Serial.printf("[mesh] Encrypted AES-128 MANET ready on Ch%u, Ant%u\n", meshChannel, activeAntenna);
}

void loop() {
  static uint32_t lastTx      = 0;
  static uint32_t lastAntEval = 0;

  // Relay queued packets with random jitter to prevent collisions
  MeshPacket fwd;
  while (relayPop(&fwd)) {
    delay(random(0, RELAY_JITTER_MAX_MS));
    uint8_t cipherBuf[sizeof(MeshPacket)];
    if (encryptMeshPacket(&fwd, cipherBuf)) {
      esp_now_send(BCAST_MAC, cipherBuf, sizeof(cipherBuf));
      Serial.printf("[relay-c6] Forwarded Node-%u seq=%u hops=%u ttl=%u\n",
                    fwd.srcId, fwd.seq, fwd.hops, fwd.ttl);
    }
  }

  // Periodic Antenna Diversity Evaluation
  if (millis() - lastAntEval >= ANT_EVAL_INTERVAL_MS) {
    lastAntEval = millis();
    evaluateAntennas();
    addBroadcastPeer();
  }

  // Periodic Telemetry Broadcast
  if (millis() - lastTx >= TX_INTERVAL_MS) {
    lastTx = millis();
    sendTelemetry();
  }
}
