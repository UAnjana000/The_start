/*
 * s3_cam_test.ino / s3_cam_test.c -- ESP32 Tactical Camera & I2S Audio Streamer
 * 
 * Target Hardware: AI-Thinker ESP32-CAM (OV2640)
 * 
 * Architecture:
 * - Port 80: Dedicated MJPEG Video HTTP Server (/stream)
 * - Port 81: Dedicated I2S PCM Audio HTTP Server (/audio)
 * - I2S_NUM_1 DMA: INMP441 Microphone (GPIO 14=BCLK, 15=WS, 13=SD)
 * - Antenna 1: GPIO 2  (IO2 on header)  -> Locked HIGH
 * - Antenna 2: GPIO 12 (IO12 on header) -> Locked LOW
 */

#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <ESPmDNS.h>
#include "esp_http_server.h"
#include "driver/i2s.h"

// ============================================================================
// 1. SELECT CAMERA MODEL
// ============================================================================
#define CAMERA_MODEL_AI_THINKER

// ============================================================================
// 2. WI-FI CREDENTIALS
// ============================================================================
const char* WIFI_SSID     = "ACT-ai_102711948432";
const char* WIFI_PASS     = "83221436";
const char* MDNS_HOSTNAME = "esp32-s3-cam";

// ============================================================================
// 3. AI-THINKER ESP32-CAM OFFICIAL PIN DEFINITIONS
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
// 4. INMP441 I2S MICROPHONE PINS (Using I2S_NUM_1 to prevent camera conflict)
// ============================================================================
#define I2S_MIC_PORT        I2S_NUM_1
#define I2S_MIC_BCLK_PIN    14    // Bit Clock (SCK)
#define I2S_MIC_WS_PIN      15    // Word Select (WS/LRCK)
#define I2S_MIC_DATA_IN_PIN 13    // Serial Data Out from Mic (SD)
#define I2S_SAMPLE_RATE     16000 // 16kHz audio sample rate

// ============================================================================
// 5. ANTENNA & EXTRA GPIO PINS
// ============================================================================
#define PIN_ANT1_GPIO2      2     // Antenna 1 (Front): IO2 on header -> HIGH
#define PIN_ANT2_GPIO12     12    // Antenna 2 (Rear):  IO12 on header -> LOW

// ============================================================================
// 6. DEDICATED HTTP SERVERS (Port 80 for Video, Port 81 for Audio)
// ============================================================================
httpd_handle_t video_httpd = NULL;
httpd_handle_t audio_httpd = NULL;

// Port 80: High-FPS MJPEG Video Stream
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[64];

  res = httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=frameboundary");
  if (res != ESP_OK) return res;

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[cam] Frame capture failed");
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

// Port 81: Live 16kHz PCM Audio Stream from INMP441 Microphone
static esp_err_t audio_handler(httpd_req_t *req) {
  esp_err_t res = ESP_OK;
  int32_t raw_buf[256];
  int16_t pcm_buf[256];
  size_t bytes_read = 0;

  res = httpd_resp_set_type(req, "audio/x-raw;rate=16000;channels=1");
  if (res != ESP_OK) return res;

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");

  while (true) {
    esp_err_t err = i2s_read(I2S_MIC_PORT, (char*)raw_buf, sizeof(raw_buf), &bytes_read, pdMS_TO_TICKS(100));
    if (err == ESP_OK && bytes_read > 0) {
      int samples = bytes_read / sizeof(int32_t);
      for (int i = 0; i < samples; i++) {
        // INMP441 outputs 24-bit MSB-aligned data; shift right 14 bits to scale to 16-bit PCM
        pcm_buf[i] = (int16_t)(raw_buf[i] >> 14);
      }
      res = httpd_resp_send_chunk(req, (const char*)pcm_buf, samples * sizeof(int16_t));
      if (res != ESP_OK) break;
    } else {
      delay(5);
    }
  }
  return res;
}

void startHttpServers() {
  // 1. Start Dedicated Video Server on Port 80
  httpd_config_t v_config = HTTPD_DEFAULT_CONFIG();
  v_config.server_port = 80;
  v_config.ctrl_port = 32768;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&video_httpd, &v_config) == ESP_OK) {
    httpd_register_uri_handler(video_httpd, &stream_uri);
    Serial.println("[http] Video Server active on :80/stream");
  }

  // 2. Start Dedicated Audio Server on Port 81 (Completely independent task)
  httpd_config_t a_config = HTTPD_DEFAULT_CONFIG();
  a_config.server_port = 81;
  a_config.ctrl_port = 32769;

  httpd_uri_t audio_uri = {
    .uri       = "/audio",
    .method    = HTTP_GET,
    .handler   = audio_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&audio_httpd, &a_config) == ESP_OK) {
    httpd_register_uri_handler(audio_httpd, &audio_uri);
    Serial.println("[http] Audio Server active on :81/audio");
  }
}

// ============================================================================
// 7. INMP441 I2S MICROPHONE INIT (I2S_NUM_1)
// ============================================================================
static void initI2SMic() {
  i2s_config_t i2s_config = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate          = I2S_SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 4,
    .dma_buf_len          = 256,
    .use_apll             = false,
    .tx_desc_auto_clear   = false,
    .fixed_mclk           = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num   = I2S_MIC_BCLK_PIN,
    .ws_io_num    = I2S_MIC_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = I2S_MIC_DATA_IN_PIN
  };

  if (i2s_driver_install(I2S_MIC_PORT, &i2s_config, 0, NULL) == ESP_OK) {
    i2s_set_pin(I2S_MIC_PORT, &pin_config);
    Serial.println("[mic] INMP441 I2S Microphone ready (GPIO 14, 15, 13)");
  } else {
    Serial.println("[mic] I2S install failed");
  }
}

// ============================================================================
// 8. SETUP -- CAMERA INIT FIRST (Official Architecture)
// ============================================================================
void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();
  Serial.println("==========================================");
  Serial.println("   AI-Thinker ESP32-CAM Streamer Test     ");
  Serial.println("==========================================");

  // 1. Configure Camera Parameters
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
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size   = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count     = 1;

  if (psramFound()) {
    config.jpeg_quality = 10;
    config.fb_count     = 2;
    config.grab_mode    = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size   = FRAMESIZE_SVGA;
    config.fb_location  = CAMERA_FB_IN_DRAM;
  }

  // 2. Camera Sensor Initialization
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[cam] Camera init failed with error 0x%x\n", err);
    return;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_framesize(s, FRAMESIZE_VGA);
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1);
      s->set_brightness(s, 1);
      s->set_saturation(s, -2);
    }
  }
  Serial.println("[cam] Camera Sensor initialized successfully!");

  // 3. Configure Antenna GPIOs
  pinMode(PIN_ANT1_GPIO2, OUTPUT);
  digitalWrite(PIN_ANT1_GPIO2, HIGH);
  Serial.println("[gpio] Antenna 1 (GPIO 2 / IO2) -> LOCKED HIGH (3.3V)");

  pinMode(PIN_ANT2_GPIO12, OUTPUT);
  digitalWrite(PIN_ANT2_GPIO12, LOW);
  Serial.println("[gpio] Antenna 2 (GPIO 12 / IO12) -> LOCKED LOW  (0.0V)");

  // 4. Initialize INMP441 Microphone (I2S_NUM_1)
  initI2SMic();

  // 5. Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  WiFi.setSleep(false);

  Serial.printf("[wifi] Connecting to %s", WIFI_SSID);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[wifi] WiFi connected!");
    Serial.print("[wifi] IP Address: http://");
    Serial.println(WiFi.localIP());
    Serial.print("[wifi] Video Stream: http://");
    Serial.print(WiFi.localIP());
    Serial.println(":80/stream");
    Serial.print("[wifi] Audio Stream: http://");
    Serial.print(WiFi.localIP());
    Serial.println(":81/audio");

    if (MDNS.begin(MDNS_HOSTNAME)) {
      MDNS.addService("http", "tcp", 80);
      MDNS.addService("http", "tcp", 81);
      Serial.printf("[mdns] Stream URL: http://%s.local:80/stream\n", MDNS_HOSTNAME);
      Serial.printf("[mdns] Audio URL:  http://%s.local:81/audio\n", MDNS_HOSTNAME);
    }

    startHttpServers();
    Serial.println("\n[ready] Camera and Mic Ready! Streaming live to dashboard.");
  } else {
    Serial.println("\n[wifi] Wi-Fi connection failed!");
  }
}

// ============================================================================
// 9. LOOP
// ============================================================================
void loop() {
  digitalWrite(PIN_ANT1_GPIO2, HIGH);
  digitalWrite(PIN_ANT2_GPIO12, LOW);
  delay(10000);
}
