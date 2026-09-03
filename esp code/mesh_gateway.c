/*
 * mesh_gateway.ino  --  ESP32 dev module (WROOM-32)
 *
 * ESP-NOW sink -> Firebase Realtime Database.
 *
 * Runs AP_STA:
 *   STA -> home router, gives internet uplink and fixes the ESP-NOW channel.
 *   AP  -> beacon named GW_AP_SSID. Nodes scan for it to learn our channel and
 *          to measure their own RSSI toward the gateway. Nobody associates to it.
 *
 * Requires Arduino-ESP32 core 3.x (esp_now_recv_info_t signature).
 * Libraries: ArduinoJson v7.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_now.h>
#include <esp_wifi.h>

// MeshPacket, RxItem and NodeRec live here. They must NOT be declared in the
// .ino: the Arduino preprocessor injects generated function prototypes above
// any typedef in the sketch, which breaks findOrAdd() and rxPop().
#include "mesh_proto.h"

// ---------------------------------------------------------------- config ---

static const char* WIFI_SSID = "ACT-ai_102711948432";
static const char* WIFI_PASS = "83221436";
static const char* DB_URL =
  "https://apparatus-certified-default-rtdb.asia-southeast1.firebasedatabase.app";

// Must match GW_AP_SSID in both node sketches.
static const char* GW_AP_SSID = "MESH-GW";
static const char* GW_AP_PASS = "meshgw12345";

static const uint32_t UPLOAD_INTERVAL_MS = 5000;
static const uint32_t NODE_STALE_MS      = 60000;
static const uint8_t  MAX_NODES          = 16;

// ------------------------------------------------------------ rx plumbing --
// The ESP-NOW callback runs on the WiFi task while loop() may be blocked for
// seconds inside an HTTPS PATCH, so the callback only enqueues.

#define RX_QUEUE_LEN 24
static RxItem          rxq[RX_QUEUE_LEN];
static volatile uint8_t rxHead = 0;
static volatile uint8_t rxTail = 0;
static portMUX_TYPE     rxMux  = portMUX_INITIALIZER_UNLOCKED;
static volatile uint32_t rxDropped = 0;

static void onEspNowRecv(const esp_now_recv_info_t* info,
                         const uint8_t* data, int len) {
  if (len != (int)sizeof(MeshPacket)) return;

  MeshPacket p;
  memcpy(&p, data, sizeof(p));
  if (p.magic != MESH_MAGIC || p.ver != MESH_VER) return;

  int8_t rssi = (info && info->rx_ctrl) ? (int8_t)info->rx_ctrl->rssi : -128;

  portENTER_CRITICAL(&rxMux);
  uint8_t next = (uint8_t)((rxHead + 1) % RX_QUEUE_LEN);
  if (next == rxTail) {
    rxDropped++;
  } else {
    rxq[rxHead].p      = p;
    rxq[rxHead].rssiGw = rssi;
    rxHead             = next;
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

// ------------------------------------------------------------ node table --

static NodeRec nodes[MAX_NODES];

static NodeRec* findOrAdd(uint8_t id) {
  for (uint8_t i = 0; i < MAX_NODES; i++)
    if (nodes[i].used && nodes[i].id == id) return &nodes[i];

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

/*
 * Flooding means the same packet can arrive by several paths. Keep the newest
 * sequence number, and within one sequence keep the copy that took the fewest
 * hops -- that copy's RSSI is the one worth reporting.
 *
 * Caveat worth remembering: for hops > 0, rssiGw describes the last relay's
 * transmission, not the original node's. Only hops == 0 is a direct measurement.
 */
static void handlePacket(const MeshPacket& p, int8_t rssiGw) {
  NodeRec* r = findOrAdd(p.srcId);
  if (!r) {
    Serial.printf("[mesh] node table full, dropping node-%u\n", p.srcId);
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

  r->seenOnce = true;
  r->lat      = p.lat;
  r->lon      = p.lon;
  r->rssiNode = p.rssiNode;
  r->antenna  = p.antenna;
  r->lastMs   = millis();
  r->dirty    = true;
}

// ----------------------------------------------------------- firebase ------

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

    JsonObject d  = o["data"].to<JsonObject>();
    d["rssiNode"] = nodes[i].rssiNode;
    d["rssiGw"]   = nodes[i].rssiGw;
    d["antenna"]  = nodes[i].antenna;
    d["hops"]     = nodes[i].hops;
    d["seq"]      = nodes[i].seq;

    included[n++] = i;
  }

  if (n == 0) return;

  String body;
  serializeJson(out, body);

  WiFiClientSecure client;
  client.setInsecure();   // prototype only: no cert pinning

  HTTPClient http;
  if (!http.begin(client, String(DB_URL) + "/nodes.json")) {
    Serial.println("[fb] begin failed");
    return;
  }
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");

  int code = http.PATCH(body);
  if (code == 200) {
    Serial.printf("[fb] ok, %u nodes, %u bytes\n", n, body.length());
    for (uint8_t i = 0; i < n; i++) nodes[included[i]].dirty = false;
  } else {
    Serial.printf("[fb] %d %s\n", code,
                  code > 0 ? http.getString().c_str()
                           : http.errorToString(code).c_str());
  }
  http.end();
}

// ---------------------------------------------------------------- setup ---

void setup() {
  Serial.begin(115200);
  delay(200);

  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);   // power save eats ESP-NOW packets

  if (!WiFi.softAP(GW_AP_SSID, GW_AP_PASS)) {
    Serial.println("[wifi] softAP failed");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[wifi] connecting");
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 30000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[wifi] no uplink, continuing -- mesh rx still works");
  } else {
    Serial.printf("[wifi] %s\n", WiFi.localIP().toString().c_str());
  }

  // The AP follows the STA channel. Nodes discover it by scanning, so we never
  // force a channel here -- doing so would break the router association.
  uint8_t ch = 0;
  wifi_second_chan_t sec;
  esp_wifi_get_channel(&ch, &sec);
  Serial.printf("[wifi] espnow channel %u, ap ssid '%s'\n", ch, GW_AP_SSID);

  if (esp_now_init() != ESP_OK) {
    Serial.println("[espnow] init failed, restarting");
    delay(2000);
    ESP.restart();
  }
  esp_now_register_recv_cb(onEspNowRecv);
  Serial.println("[espnow] listening");
}

// ----------------------------------------------------------------- loop ---

void loop() {
  static uint32_t lastUpload   = 0;
  static uint32_t lastWifiTry  = 0;
  static uint32_t lastChanLog  = 0;

  RxItem it;
  while (rxPop(&it)) {
    handlePacket(it.p, it.rssiGw);
    Serial.printf("[mesh] node-%u seq=%u hops=%u ant=%u rssiNode=%d rssiGw=%d\n",
                  it.p.srcId, it.p.seq, it.p.hops, it.p.antenna,
                  it.p.rssiNode, it.rssiGw);
  }

  if (rxDropped) {
    Serial.printf("[mesh] rx queue overflow x%lu\n", (unsigned long)rxDropped);
    rxDropped = 0;
  }

  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiTry > 10000) {
      lastWifiTry = millis();
      Serial.println("[wifi] reconnecting");
      WiFi.reconnect();
    }
    return;
  }

  if (millis() - lastChanLog > 60000) {
    lastChanLog = millis();
    uint8_t ch = 0;
    wifi_second_chan_t sec;
    esp_wifi_get_channel(&ch, &sec);
    Serial.printf("[wifi] channel %u\n", ch);
  }

  if (millis() - lastUpload >= UPLOAD_INTERVAL_MS) {
    lastUpload = millis();
    uploadAll();
  }
}
