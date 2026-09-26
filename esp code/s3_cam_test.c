/*
 * s3_cam_test.c (or s3_cam_test.ino) -- ESP32 / ESP32-S3 Camera Wi-Fi Streamer
 * 
 * Simple Standalone Camera Test Firmware:
 * 1. Connects directly to local Wi-Fi.
 * 2. Initializes Camera Sensor (OV2640 / OV3660 / OV5640).
 * 3. Starts mDNS responder (http://esp32-s3-cam.local/stream).
 * 4. Serves high-throughput MJPEG video stream over HTTP on port 80 (/stream)
 *    for ingestion by the Node.js Video Relay (video-backend/server.js).
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include "esp_http_server.h"

// ============================================================================
// 1. SELECT YOUR CAMERA BOARD MODEL (Uncomment ONLY ONE)
// ============================================================================
#define CAMERA_MODEL_XIAO_ESP32S3        // Seeed Studio XIAO ESP32-S3 Sense
// #define CAMERA_MODEL_FREENOVE_ESP32S3_CAM // Freenove ESP32-S3-WROOM CAM / S3-EYE
// #define CAMERA_MODEL_AI_THINKER          // Standard ESP32-CAM (AI-Thinker)

// ============================================================================
// 2. WI-FI CONFIGURATION (Change to your Wi-Fi credentials)
// ============================================================================
const char* WIFI_SSID     = "ACT-ai_102711948432";
const char* WIFI_PASS     = "83221436";
const char* MDNS_HOSTNAME = "esp32-s3-cam";

// ============================================================================
// 3. CAMERA PIN DEFINITIONS
// ============================================================================
#if defined(CAMERA_MODEL_XIAO_ESP32S3)
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

#elif defined(CAMERA_MODEL_FREENOVE_ESP32S3_CAM)
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

#elif defined(CAMERA_MODEL_AI_THINKER)
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

#else
  #error "Camera model not selected! Uncomment one of the CAMERA_MODEL_* defines above."
#endif

httpd_handle_t stream_httpd = NULL;

// ============================================================================
// 4. MJPEG HTTP STREAM HANDLER
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
        "--frameboundary\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", (unsigned int)fb->len);
      
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
  } else {
    Serial.println("[http] Failed to start HTTP stream server");
  }
}

// ============================================================================
// 5. SETUP & INITIALIZATION
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==========================================");
  Serial.println("     Camera Wi-Fi Streamer Test           ");
  Serial.println("==========================================");

  // Configure Camera Hardware Parameters - Ensure structure is fully zeroed out
  camera_config_t config;
  memset(&config, 0, sizeof(camera_config_t));

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

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR < 3 && !defined(ESP_IDF_VERSION_MAJOR)
  config.pin_siod     = SIOD_GPIO_NUM;
  config.pin_sioc     = SIOC_GPIO_NUM;
#else
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
#endif

  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    Serial.println("[psram] PSRAM detected! Using VGA 640x480 resolution");
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 10; // 0-63 (lower means higher quality)
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
    Serial.println("[cam] HINT: Check if you selected the correct camera board model pinout.");
    return;
  }
  Serial.println("[cam] Camera Sensor Initialized Successfully!");

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[wifi] Connecting to Wi-Fi: %s", WIFI_SSID);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[wifi] Connected successfully!");
    Serial.print("[wifi] IP Address: http://");
    Serial.println(WiFi.localIP());
    Serial.print("[wifi] Stream URL: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/stream");

    // Start mDNS Responder
    if (MDNS.begin(MDNS_HOSTNAME)) {
      MDNS.addService("http", "tcp", 80);
      Serial.printf("[mdns] Stream discoverable at: http://%s.local/stream\n", MDNS_HOSTNAME);
    }

    // Start MJPEG HTTP server
    startCameraServer();
    Serial.println("\n[ready] Video feed ready. Open the frontend Video Feed tab!");
  } else {
    Serial.println("\n[wifi] Failed to connect to Wi-Fi! Please verify SSID & Password.");
  }
}

// ============================================================================
// 6. MAIN LOOP
// ============================================================================
void loop() {
  delay(1000);
}
