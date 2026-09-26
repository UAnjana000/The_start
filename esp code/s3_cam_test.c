/*
 * s3_cam_test.c (or s3_cam_test.ino) -- ESP32-S3 Camera Wi-Fi Streamer
 * 
 * Simple Standalone Camera Test Firmware:
 * 1. Connects directly to local Wi-Fi.
 * 2. Initializes OV2640 / OV3660 / OV5640 Camera Sensor on ESP32-S3.
 * 3. Starts mDNS responder (http://esp32-s3-cam.local/stream).
 * 4. Serves high-throughput MJPEG video stream over HTTP on port 80 (/stream)
 *    for ingestion by the Node.js Video Relay (video-backend/server.js).
 * 
 * Board: Seeed XIAO ESP32-S3 Sense / Freenove ESP32-S3-WROOM CAM / AI-Thinker S3.
 * Requires Arduino-ESP32 Core 3.x with PSRAM enabled: "OPI PSRAM".
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include "esp_http_server.h"

// ============================================================================
// 1. WI-FI CONFIGURATION (Replace with your local Wi-Fi / Mobile Hotspot)
// ============================================================================
const char* WIFI_SSID     = "ACT-ai_102711948432";
const char* WIFI_PASS     = "83221436";
const char* MDNS_HOSTNAME = "esp32-s3-cam";

// ============================================================================
// 2. CAMERA PIN CONFIGURATION
// Default Pinout: Seeed Studio XIAO ESP32-S3 Sense
// (If using Freenove ESP32-S3-WROOM CAM, uncomment the Freenove section below)
// ============================================================================

// --- XIAO ESP32-S3 Sense Default Pinout ---
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     10
#define SIOD_GPIO_NUM     40
#define SIOC_GPIO_NUM     39
#define Y9_GPIO_NUM       48
#define Y8_GPIO_NUM       11
#define Y7_GPIO_NUM       12
#define Y6_GPIO_NUM       14
#define Y5_GPIO_NUM       16
#define Y4_GPIO_NUM       18
#define Y3_GPIO_NUM       17
#define Y2_GPIO_NUM       15
#define VSYNC_GPIO_NUM    38
#define HREF_GPIO_NUM     47
#define PCLK_GPIO_NUM     13

/*
// --- UNCOMMENT FOR FREENOVE ESP32-S3 CAM ---
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     15
#define SIOD_GPIO_NUM      4
#define SIOC_GPIO_NUM      5
#define Y9_GPIO_NUM       16
#define Y8_GPIO_NUM       17
#define Y7_GPIO_NUM       18
#define Y6_GPIO_NUM       12
#define Y5_GPIO_NUM       10
#define Y4_GPIO_NUM        8
#define Y3_GPIO_NUM        9
#define Y2_GPIO_NUM       11
#define VSYNC_GPIO_NUM     6
#define HREF_GPIO_NUM      7
#define PCLK_GPIO_NUM     13
*/

httpd_handle_t stream_httpd = NULL;

// ============================================================================
// 3. MJPEG HTTP STREAM HANDLER
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
      Serial.println("[cam] Error: Failed to capture camera frame");
      res = ESP_FAIL;
    } else {
      size_t hlen = snprintf(part_buf, sizeof(part_buf),
        "--frameboundary\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", fb->len);
      
      res = httpd_resp_send_chunk(req, part_buf, hlen);
      if (res == ESP_OK) {
        res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
      }
      if (res == ESP_OK) {
        res = httpd_resp_send_chunk(req, "\r\n", 2);
      }
      
      esp_camera_fb_return(fb);
      if (res != ESP_OK) break;
    }
  }
  return res;
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.ctrl_port = 32768;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    Serial.println("[http] MJPEG Stream server listening on port :80/stream");
  }
}

// ============================================================================
// 4. SETUP & INITIALIZATION
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==========================================");
  Serial.println("   ESP32-S3 Camera Wi-Fi Streamer Test    ");
  Serial.println("==========================================");

  // Configure Camera Hardware Parameters
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
    Serial.println("[psram] PSRAM detected! Using VGA 640x480 resolution");
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 10; // 0-63 lower means higher quality
    config.fb_count     = 2;
    config.grab_mode    = CAMERA_GRAB_LATEST;
  } else {
    Serial.println("[psram] No PSRAM detected. Falling back to QVGA 320x240");
    config.frame_size   = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count     = 1;
  }

  // Camera Sensor Initialization
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[cam] Camera initialization failed with error: 0x%x\n", err);
    return;
  }
  Serial.println("[cam] Camera Sensor Initialized Successfully!");

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.printf("[wifi] Connecting to SSID: '%s'", WIFI_SSID);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 30000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[wifi] WiFi Connected!");
    Serial.printf("[wifi] Local IP Address: http://%s/stream\n", WiFi.localIP().toString().c_str());

    // Start mDNS Responder: http://esp32-s3-cam.local/stream
    if (MDNS.begin(MDNS_HOSTNAME)) {
      Serial.printf("[mdns] Responder started: http://%s.local/stream\n", MDNS_HOSTNAME);
    }
  } else {
    Serial.println("[wifi] Error: Failed to connect to WiFi within 30s timeout.");
  }

  // Start HTTP Stream Server
  startCameraServer();
  Serial.println("\n[ready] Stream Ready! Feed URL for backend:");
  Serial.printf("        http://%s/stream  OR  http://%s.local/stream\n\n",
                WiFi.localIP().toString().c_str(), MDNS_HOSTNAME);
}

// ============================================================================
// 5. MAIN LOOP (Managed asynchronously by FreeRTOS HTTP Server)
// ============================================================================
void loop() {
  // Check Wi-Fi connection and auto-reconnect if lost
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[wifi] Reconnecting to Wi-Fi...");
    WiFi.reconnect();
    delay(5000);
  }
  delay(10000);
}
