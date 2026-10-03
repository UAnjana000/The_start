/*
 * mesh_gateway.c (or mesh_gateway.ino) -- ESP32 Dev Module (WROOM-32)
 *
 * Tactical Base Station Mesh Sink & Cloud/Video Bridge featuring:
 * 1. AES-128 Decrypted ESP-NOW Reception from Ad-Hoc MANET.
 * 2. Multi-Hop Deduplication and Best-Path Selection based on hops and RSSI.
 * 3. Dynamic Ad-Hoc Topology & Antenna State Uplink to Firebase RTDB.
 * 4. Dual-Mode AP+STA (Station for Cloud/WebSockets, SoftAP Beacon 'MESH-GW').
 * 5. Video Stream Bridge / Proxy Health Verification.
 *
 * Requires Arduino-ESP32 Core 3.x, ArduinoJson v7.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_now.h>
#include <esp_wifi.h>

// Protocol definitions, packet structs & AES-128 CBC crypto
#include "mesh_proto.h"

// ============================================================================
// CONFIGURATION
// ============================================================================
static const char* WIFI_SSID = "Ground floor";
static const char* WIFI_PASS = "Anjanaamulya";
static const char* DB_URL    = "https://apparatus-certified-default-rtdb.asia-southeast1.firebasedatabase.app";

// Beacon SSID for soldier nodes to find channel & measure RSSI
static const char* GW_AP_SSID = "MESH-GW";
static const char* GW_AP_PASS = "meshgw12345";

// Video Stream Target Endpoint (ESP32-CAM connected directly to MESH-GW SoftAP)
static const char* CAM_STREAM_URL = "http://192.168.4.2/stream";

static const uint32_t UPLOAD_INTERVAL_MS = 4000;
static const uint32_t NODE_STALE_MS      = 60000;
static const uint8_t  MAX_NODES          = 16;

// ============================================================================
// RX PLUMBING (FreeRTOS Ring Buffer)
// ============================================================================
#define RX_QUEUE_LEN 24
static RxItem          rxq[RX_QUEUE_LEN];
static volatile uint8_t rxHead = 0;
static volatile uint8_t rxTail = 0;
static portMUX_TYPE     rxMux  = portMUX_INITIALIZER_UNLOCKED;
static volatile uint32_t rxDropped = 0;

static void onEspNowRecv(const esp_now_recv_info_t* info, const uint8_t* data, int len) {
  if (len != (int)sizeof(MeshPacket)) return;

  // Decrypt incoming payload with AES-128-CBC
  MeshPacket p;
  if (!decryptMeshPacket(data, len, &p)) {
    // Drop malformed / foreign / undecryptable packets
    return;
  }

  int8_t rssi = (info && info->rx_ctrl) ? (int8_t)info->rx_ctrl->rssi : -128;

  portENTER_CRITICAL(&rxMux);
  uint8_t next = (uint8_t)((rxHead + 1) % RX_QUEUE_LEN);
  if (next == rxTail) {
    rxDropped++;
  } else {
    rxq[rxHead].p           = p;
    rxq[rxHead].rssiGw      = rssi;
    rxq[rxHead].rxTimestamp = millis();
    rxHead                  = next;
  }
  portEXIT_CRITICAL(&rxMux);
}

static bool rxPop(RxItem* out) {
  bool got = false;
  portENTER_CRITICAL(&rxMux);
  if (rxTail != rxHead) {
    *out   = rxq[rxTail];
    rxTail = (uint8_t)((rxTail + 1) % RX_QUEUE_LEN);
    got    = true;
  }
  portEXIT_CRITICAL(&rxMux);
  return got;
}

// ============================================================================
// NODE STATE TABLE & DYNAMIC TOPOLOGY
// ============================================================================
static NodeRec nodes[MAX_NODES];

static NodeRec* findOrAdd(uint8_t id) {
  for (uint8_t i = 0; i < MAX_NODES; i++) {
    if (nodes[i].used && nodes[i].id == id) return &nodes[i];
  }
  for (uint8_t i = 0; i < MAX_NODES; i++) {
    if (!nodes[i].used) {
      nodes[i]      = {};
      nodes[i].used = true;
      nodes[i].id   = id;
      nodes[i].hops = 0xFF;
      return &nodes[i];
    }
  }
  return nullptr;
}

static void handlePacket(const MeshPacket& p, int8_t rssiGw) {
  NodeRec* r = findOrAdd(p.srcId);
  if (!r) {
    Serial.printf("[mesh] Node table full, dropping Node-%u\n", p.srcId);
    return;
  }

  bool newer      = !r->seenOnce || ((int16_t)(p.seq - r->seq) > 0);
  bool betterPath = r->seenOnce && (p.seq == r->seq) && (p.hops < r->hops);
  if (!newer && !betterPath) return;

  if (newer) {
    r->seq  = p.seq;
    r->hops = 0xFF;
  }

  if (p.hops <= r->hops) {
    r->hops   = p.hops;
    r->rssiGw = rssiGw;
  }

  r->seenOnce    = true;
  r->lat         = p.lat;
  r->lon         = p.lon;
  r->rssiNode    = p.rssiNode;
  r->antenna     = p.antenna;
  r->bestRelayId = p.bestRelayId;
  r->linkRssi    = p.linkRssi;
  r->hasVideo    = p.hasVideo;
  r->lastMs      = millis();
  r->dirty       = true;
}

// ============================================================================
// FIREBASE REALTIME DATABASE UPLINK
// ============================================================================
static void uploadAll() {
  JsonDocument out;
  uint8_t  included[MAX_NODES];
  uint8_t  n   = 0;
  uint32_t now = millis();
  char     key[16];

  for (uint8_t i = 0; i < MAX_NODES; i++) {
    if (!nodes[i].used || !nodes[i].dirty) continue;
    if (now - nodes[i].lastMs > NODE_STALE_MS) continue;

    snprintf(key, sizeof(key), "node-%u", nodes[i].id);
    JsonObject o = out[key].to<JsonObject>();
    o["lat"]       = nodes[i].lat;
    o["lon"]       = nodes[i].lon;
    o["ts"][".sv"] = "timestamp";

    JsonObject d   = o["data"].to<JsonObject>();
    d["rssiNode"]    = nodes[i].rssiNode;
    d["rssiGw"]      = nodes[i].rssiGw;
    d["antenna"]     = nodes[i].antenna;
    d["hops"]        = nodes[i].hops;
    d["seq"]         = nodes[i].seq;
    d["bestRelayId"] = nodes[i].bestRelayId;
    d["linkRssi"]    = nodes[i].linkRssi;
    d["hasVideo"]    = nodes[i].hasVideo;

    included[n++] = i;
  }

  if (n == 0) return;

  String body;
  serializeJson(out, body);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, String(DB_URL) + "/nodes.json")) {
    Serial.println("[fb] Connection initialization failed");
    return;
  }
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");

  int code = http.PATCH(body);
  if (code == 200) {
    Serial.printf("[fb] Sync success: %u nodes updated (%u bytes)\n", n, body.length());
    for (uint8_t i = 0; i < n; i++) nodes[included[i]].dirty = false;
  } else {
    Serial.printf("[fb] Error %d: %s\n", code,
                  code > 0 ? http.getString().c_str() : http.errorToString(code).c_str());
  }
  http.end();
}

// ============================================================================
// CAMERA STREAM BRIDGE PING / HEALTH CHECK
// ============================================================================
static void checkVideoHealth() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(CAM_STREAM_URL);
  http.setTimeout(2500);
  int httpCode = http.GET();
  if (httpCode > 0) {
    Serial.printf("[cam-bridge] C6 Video Stream alive, HTTP status: %d\n", httpCode);
  } else {
    Serial.printf("[cam-bridge] C6 Video offline / unresolvable: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ============================================================================
// VIDEO PROXY SERVER (Core 0 FreeRTOS Task)
// Bridges incoming /stream requests from PC/Backend to the ESP32-CAM (192.168.4.2)
// ============================================================================
static void videoProxyTask(void* pvParameters) {
  WiFiServer proxyServer(80);
  proxyServer.begin();
  uint8_t buf[1024];

  while (true) {
    WiFiClient client = proxyServer.available();
    if (client) {
      Serial.println("[proxy] Backend client connected to Gateway /stream. Bridging to ESP32-CAM (192.168.4.2:80)...");
      WiFiClient camClient;
      IPAddress camIp(192, 168, 4, 2);

      if (camClient.connect(camIp, 80)) {
        camClient.print("GET /stream HTTP/1.1\r\nHost: 192.168.4.2\r\nConnection: close\r\n\r\n");
        Serial.println("[proxy] Cam stream bridge active!");

        while (client.connected() && camClient.connected()) {
          int avail = camClient.available();
          if (avail > 0) {
            int len = camClient.read(buf, min(avail, (int)sizeof(buf)));
            if (len > 0) {
              client.write(buf, len);
            }
          } else {
            vTaskDelay(pdMS_TO_TICKS(5));
          }
        }
        camClient.stop();
        Serial.println("[proxy] Stream closed");
      } else {
        Serial.println("[proxy] Cannot reach ESP32-CAM at 192.168.4.2:80");
        client.print("HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\n\r\nESP32-CAM offline on MESH-GW\r\n");
      }
      client.stop();
    }
    vTaskDelay(pdMS_TO_TICKS(15));
  }
}

// ============================================================================
// SETUP & MAIN LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[gateway] Booting Tactical Mesh Gateway & Video Bridge...");

  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);

  // SoftAP Beacon for soldier node channel tracking
  if (!WiFi.softAP(GW_AP_SSID, GW_AP_PASS)) {
    Serial.println("[wifi] softAP beacon startup failed");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[wifi] Connecting to command router");
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 30000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] Uplink connected! Gateway IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[wifi] Router unavailable, local mesh reception remains active");
  }

  uint8_t ch = 0;
  wifi_second_chan_t sec;
  esp_wifi_get_channel(&ch, &sec);
  Serial.printf("[wifi] Operating on Channel %u with SoftAP '%s'\n", ch, GW_AP_SSID);

  // Launch video proxy on Core 0 so it never blocks mesh processing
  xTaskCreatePinnedToCore(videoProxyTask, "video_proxy", 8192, NULL, 1, NULL, 0);
  Serial.println("[proxy] Video Stream Proxy listening on Gateway Port 80 (/stream)");

  if (esp_now_init() != ESP_OK) {
    Serial.println("[espnow] Init failed, restarting...");
    delay(2000);
    ESP.restart();
  }
  esp_now_register_recv_cb(onEspNowRecv);
  Serial.println("[espnow] AES-128 Encrypted Mesh Sink listening");
}

void loop() {
  static uint32_t lastUpload   = 0;
  static uint32_t lastWifiTry  = 0;
  static uint32_t lastCamPing  = 0;

  // Process incoming decrypted mesh packets from FreeRTOS queue
  RxItem it;
  while (rxPop(&it)) {
    handlePacket(it.p, it.rssiGw);
    Serial.printf("[mesh] Node-%u | Seq=%u | Hops=%u | Ant=%u | BestRelay=Node-%u | RSSI_Gw=%d | RSSI_Link=%d | Video=%d\n",
                  it.p.srcId, it.p.seq, it.p.hops, it.p.antenna,
                  it.p.bestRelayId, it.rssiGw, it.p.linkRssi, it.p.hasVideo);
  }

  if (rxDropped) {
    Serial.printf("[mesh] Warning: RX buffer overflow (%lu packets dropped)\n", (unsigned long)rxDropped);
    rxDropped = 0;
  }

  // WiFi Reconnection handling
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiTry > 15000) {
      lastWifiTry = millis();
      Serial.printf("[wifi] Retrying connection to '%s'...\n", WIFI_SSID);
      WiFi.disconnect(false);
      delay(100);
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
    return;
  }

  // Periodic Camera Stream Health Check (every 15 seconds)
  if (millis() - lastCamPing >= 15000) {
    lastCamPing = millis();
    checkVideoHealth();
  }

  // Periodic Firebase Cloud Uplink (every 4 seconds)
  if (millis() - lastUpload >= UPLOAD_INTERVAL_MS) {
    lastUpload = millis();
    uploadAll();
  }
}
