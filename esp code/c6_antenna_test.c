/*
 * c6_antenna_test.ino / c6_antenna_test.c -- Seeed XIAO ESP32-C6 Minimal Pin Lock
 * 
 * Sets D4 (GPIO 22) to HIGH (3.3V) and keeps it ON permanently.
 * Enables external u.FL antenna path on Seeed XIAO ESP32-C6.
 * No Wi-Fi, no background tasks, nothing else.
 */

#include <Arduino.h>

// Physical Pad D4 on Seeed Studio XIAO ESP32-C6 is GPIO 22
#if defined(D4)
  #define PIN_D4  D4
#else
  #define PIN_D4  22
#endif

// Physical Pad D5 (GPIO 23)
#if defined(D5)
  #define PIN_D5  D5
#else
  #define PIN_D5  23
#endif

// Seeed on-board RF multiplexer (routes RF to external u.FL connector)
#define XIAO_RF_EN_PIN     3    // LOW enables on-board RF switch
#define XIAO_ANT_SEL_PIN   14   // HIGH routes RF to external u.FL port

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==========================================");
  Serial.println("  Seeed XIAO ESP32-C6: D4 LOCKED HIGH (ON)");
  Serial.println("==========================================");

  // 1. Lock D4 HIGH (3.3V)
  pinMode(PIN_D4, OUTPUT);
  digitalWrite(PIN_D4, HIGH);
  Serial.println("[gpio] D4 (GPIO 22) set to HIGH (3.3V)");

  // 2. Set D5 LOW (0V)
  pinMode(PIN_D5, OUTPUT);
  digitalWrite(PIN_D5, LOW);
  Serial.println("[gpio] D5 (GPIO 23) set to LOW (0V)");

  // 3. Route on-board RF path to external u.FL connector
  pinMode(XIAO_RF_EN_PIN, OUTPUT);
  digitalWrite(XIAO_RF_EN_PIN, LOW);
  pinMode(XIAO_ANT_SEL_PIN, OUTPUT);
  digitalWrite(XIAO_ANT_SEL_PIN, HIGH);
  Serial.println("[rf] Seeed RF switch -> External u.FL ACTIVE");

  Serial.println("\n[status] D4 is permanently ON. Ready for hardware/multimeter check.");
}

void loop() {
  // Keep D4 strictly HIGH
  digitalWrite(PIN_D4, HIGH);
  delay(1000);
}
