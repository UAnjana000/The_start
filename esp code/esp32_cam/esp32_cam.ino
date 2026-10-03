/*
 * esp32_cam.ino -- Standalone High-Stability ESP32-CAM Streamer
 * 
 * Hardware: AI-Thinker ESP32-CAM (OV2640 Sensor)
 * 
 * Features:
 * 1. Direct Wi-Fi connection to your router/hotspot.
 * 2. Dedicated MJPEG Video Stream on Port 80 (/stream).
 * 3. Single-frame snapshot endpoint (/capture).
 * 4. Built-in CORS headers (Access-Control-Allow-Origin: *) for direct frontend embedding.
 * 5. Brownout protection disabled to prevent startup voltage sag resets.
 * 6. Safe memory allocation for both PSRAM and DRAM.
 */

#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ============================================================================
// 1. WI-FI CONFIGURATION
// ============================================================================
// Enter your 2.4GHz Wi-Fi or Mobile Hotspot credentials here:
const char* WIFI_SSID = "Ground floor";
const char* WIFI_PASS = "Anjanaamulya";

// ============================================================================
// 2. AI-THINKER ESP32-CAM PIN DEFINITIONS
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

#define FLASH_LED_PIN      4

// ============================================================================
// 3. HTTP STREAM SERVER & HANDLERS
// ============================================================================
httpd_handle_t stream_httpd = NULL;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// Endpoint: /stream (Continuous MJPEG Stream for Frontend)
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "X-Framerate", "25");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[cam] Camera capture failed");
      res = ESP_FAIL;
    } else {
      if (fb->format != PIXFORMAT_JPEG) {
        bool jpeg_converted = frame2jpg(fb, 80, &_jpg_buf, &_jpg_buf_len);
        esp_camera_fb_return(fb);
        fb = NULL;
        if (!jpeg_converted) {
          Serial.println("[cam] JPEG compression failed");
          res = ESP_FAIL;
        }
      } else {
        _jpg_buf_len = fb->len;
        _jpg_buf = fb->buf;
      }
    }

    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }

    if (fb) {
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if (_jpg_buf) {
      free(_jpg_buf);
      _jpg_buf = NULL;
    }

    if (res != ESP_OK) {
      break;
    }
  }

  return res;
}

// Endpoint: /capture (Single Snapshot)
static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[cam] Frame capture failed");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

// Endpoint: / (Welcome & Test View)
static esp_err_t index_handler(httpd_req_t *req) {
  const char* html = 
    "<!DOCTYPE html><html><head><title>ESP32-CAM Live</title>"
    "<meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<style>body{background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:20px;}"
    "img{max-width:95%;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);margin-top:15px;}</style></head>"
    "<body><h2>AI-Thinker ESP32-CAM Direct Stream</h2>"
    "<p>Stream URL: <code>/stream</code> | Snapshot: <code>/capture</code></p>"
    "<img src='/stream' alt='Live Video Stream' />"
    "</body></html>";
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, html, strlen(html));
}

static void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.ctrl_port = 32768;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t index_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = index_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &index_uri);
    Serial.println("[http] Camera Stream server started on port 80");
  } else {
    Serial.println("[http] Error starting stream server!");
  }
}

// ============================================================================
// 4. SETUP
// ============================================================================
void setup() {
  // Disable brownout detector to prevent voltage drop resets
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(300);
  Serial.println("\n\n==========================================");
  Serial.println("  AI-Thinker ESP32-CAM Direct Web Stream   ");
  Serial.println("==========================================");

  // Initialize Camera Configuration
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
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    Serial.println("[cam] PSRAM detected! Setting VGA resolution.");
    config.frame_size   = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 10;             // 10-63 (lower = higher quality)
    config.fb_count     = 2;
  } else {
    Serial.println("[cam] No PSRAM detected. Setting safe QVGA resolution.");
    config.frame_size   = FRAMESIZE_QVGA; // 320x240 safe for internal DRAM
    config.jpeg_quality = 12;
    config.fb_count     = 1;
  }

  // Camera Init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[cam] Initial camera init failed: 0x%x. Retrying with safe clock...\n", err);
    config.xclk_freq_hz = 10000000;
    config.frame_size   = FRAMESIZE_QVGA;
    config.fb_count     = 1;
    err = esp_camera_init(&config);
    if (err != ESP_OK) {
      Serial.printf("[cam] FATAL: Camera init failed: 0x%x\n", err);
      Serial.println("[cam] Check camera ribbon cable & ensure 5V power supply.");
      return;
    }
  }

  // Optional sensor adjustments
  sensor_t * s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_vflip(s, 1);       // Flip vertically if mounted upside down
    s->set_brightness(s, 1);  // Slightly brighter
    s->set_saturation(s, 0);  // Normal saturation
  }
  Serial.println("[cam] OV2640 Sensor online!");

  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  WiFi.setSleep(false);

  Serial.printf("[wifi] Connecting to %s", WIFI_SSID);
  uint32_t startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 25000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("==========================================");
    Serial.printf("[wifi] CONNECTED! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[cam] Direct Stream: http://%s/stream\n", WiFi.localIP().toString().c_str());
    Serial.printf("[cam] Snapshot URL:  http://%s/capture\n", WiFi.localIP().toString().c_str());
    Serial.println("==========================================");

    startCameraServer();
  } else {
    Serial.println("[wifi] Failed to connect to Wi-Fi. Check SSID and password.");
  }
}

// ============================================================================
// 5. LOOP
// ============================================================================
void loop() {
  // Check Wi-Fi connection health
  if (WiFi.status() != WL_CONNECTED) {
    delay(5000);
    Serial.println("[wifi] Reconnecting...");
    WiFi.reconnect();
  }
  delay(1000);
}
