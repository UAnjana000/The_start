/*
 * c6_antenna_test.ino / c6_antenna_test.c -- Seeed XIAO ESP32-C6 Antenna Lock & RF Benchmark Test
 * 
 * Purpose:
 * 1. Locks the RF path to 1 specific antenna permanently (Antenna 1 Front / External u.FL)
 *    so you can test signal strength and hardware before soldering.
 * 2. Connects to Wi-Fi and logs live RSSI (signal strength in dBm) every 2 seconds.
 * 3. Scans surrounding Wi-Fi networks and measures real-time reception power.
 * 4. Allows on-the-fly antenna switching via Serial Monitor commands ('1', '2', 'u', 'c').
 * 
 * Target Board: Seeed Studio XIAO ESP32-C6 (or standard ESP32-C6 DevKit)
 */

#include <Arduino.h>
#include <WiFi.h>

// ============================================================================
// 1. WI-FI CREDENTIALS (Change to your test Wi-Fi network)
// ============================================================================
const char* WIFI_SSID = "ACT-ai_102711948432";
const char* WIFI_PASS = "83221436";

// ============================================================================
// 2. HARDWARE PIN DEFINITIONS (Seeed Studio XIAO ESP32-C6)
// ============================================================================
// On-board RF Multiplexer on Seeed XIAO ESP32-C6
#define XIAO_RF_EN_PIN     3    // LOW: Enables on-board RF switch
#define XIAO_ANT_SEL_PIN   14   // HIGH: External u.FL port | LOW: On-board ceramic antenna

// Dual-Antenna SPDT Switch (Skyworks AS179-92LF / PE4259)
#define AS179_V1_PIN       22   // D4 (GPIO22) -> Control Line 1
#define AS179_V2_PIN       23   // D5 (GPIO23) -> Control Line 2

// Built-in User LED
#define USER_LED_PIN       15

// ============================================================================
// 3. ANTENNA CONFIGURATION (Locks Antenna 1 Active by default)
// ============================================================================
enum AntennaMode {
  ANT_1_FRONT_EXTERNAL,  // Antenna 1 (Front Sector Patch via External u.FL)
  ANT_2_REAR_EXTERNAL,   // Antenna 2 (Rear Whip via External u.FL)
  ANT_CERAMIC_ONBOARD    // On-board ceramic chip antenna
};

AntennaMode currentAntenna = ANT_1_FRONT_EXTERNAL;

void applyAntennaLock(AntennaMode mode) {
  currentAntenna = mode;

  switch (mode) {
    case ANT_1_FRONT_EXTERNAL:
      // Enable external u.FL port
      pinMode(XIAO_RF_EN_PIN, OUTPUT);
      digitalWrite(XIAO_RF_EN_PIN, LOW);
      pinMode(XIAO_ANT_SEL_PIN, OUTPUT);
      digitalWrite(XIAO_ANT_SEL_PIN, HIGH);

      // Lock SPDT switch to Antenna 1 (V1 HIGH, V2 LOW)
      pinMode(AS179_V1_PIN, OUTPUT);
      pinMode(AS179_V2_PIN, OUTPUT);
      digitalWrite(AS179_V1_PIN, HIGH);
      digitalWrite(AS179_V2_PIN, LOW);

      Serial.println("\n=======================================================");
      Serial.println(" [RF LOCKED] -> ANTENNA 1 (FRONT SECTOR / EXTERNAL u.FL)");
      Serial.println(" State: V1=HIGH (GPIO22), V2=LOW (GPIO23), ANT_SEL=HIGH");
      Serial.println("=======================================================");
      break;

    case ANT_2_REAR_EXTERNAL:
      // Enable external u.FL port
      pinMode(XIAO_RF_EN_PIN, OUTPUT);
      digitalWrite(XIAO_RF_EN_PIN, LOW);
      pinMode(XIAO_ANT_SEL_PIN, OUTPUT);
      digitalWrite(XIAO_ANT_SEL_PIN, HIGH);

      // Lock SPDT switch to Antenna 2 (V1 LOW, V2 HIGH)
      pinMode(AS179_V1_PIN, OUTPUT);
      pinMode(AS179_V2_PIN, OUTPUT);
      digitalWrite(AS179_V1_PIN, LOW);
      digitalWrite(AS179_V2_PIN, HIGH);

      Serial.println("\n=======================================================");
      Serial.println(" [RF LOCKED] -> ANTENNA 2 (REAR SECTOR / EXTERNAL u.FL)");
      Serial.println(" State: V1=LOW (GPIO22), V2=HIGH (GPIO23), ANT_SEL=HIGH");
      Serial.println("=======================================================");
      break;

    case ANT_CERAMIC_ONBOARD:
      // Route to internal ceramic antenna
      pinMode(XIAO_RF_EN_PIN, OUTPUT);
      digitalWrite(XIAO_RF_EN_PIN, LOW);
      pinMode(XIAO_ANT_SEL_PIN, OUTPUT);
      digitalWrite(XIAO_ANT_SEL_PIN, LOW);

      Serial.println("\n=======================================================");
      Serial.println(" [RF LOCKED] -> ON-BOARD CERAMIC CHIP ANTENNA");
      Serial.println(" State: ANT_SEL=LOW (GPIO14)");
      Serial.println("=======================================================");
      break;
  }
}

// ============================================================================
// 4. SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println("\n#######################################################");
  Serial.println("   SEEED XIAO ESP32-C6 ANTENNA BENCHMARK TEST TOOL    ");
  Serial.println("#######################################################");

  // Initialize LED
  pinMode(USER_LED_PIN, OUTPUT);
  digitalWrite(USER_LED_PIN, HIGH); // Off for active-low LED

  // Lock to Antenna 1 (Front Sector Patch) permanently
  applyAntennaLock(ANT_1_FRONT_EXTERNAL);

  // Connect to Wi-Fi to measure live link quality
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  Serial.printf("\n[wifi] Connecting to SSID: %s ...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    digitalWrite(USER_LED_PIN, !digitalRead(USER_LED_PIN)); // Blink LED
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(USER_LED_PIN, LOW); // Solid ON when connected
    Serial.println("\n[wifi] Connected successfully!");
    Serial.printf("[wifi] IP Assigned: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[wifi] Initial RSSI: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[wifi] Wi-Fi connection timed out. Will continue reporting scan benchmarks.");
  }

  Serial.println("\n-------------------------------------------------------");
  Serial.println("Interactive Controls (Type in Serial Monitor & press Enter):");
  Serial.println("  '1' -> Lock to Antenna 1 (Front Patch / External u.FL)");
  Serial.println("  '2' -> Lock to Antenna 2 (Rear Whip / External u.FL)");
  Serial.println("  'c' -> Lock to On-board Ceramic Antenna");
  Serial.println("  's' -> Run full Wi-Fi Environment Scan");
  Serial.println("-------------------------------------------------------\n");
}

// ============================================================================
// 5. MAIN LOOP
// ============================================================================
unsigned long lastRssiPrint = 0;
unsigned long lastScanTime  = 0;

void loop() {
  // 1. Process Serial Monitor Commands
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == '1') {
      applyAntennaLock(ANT_1_FRONT_EXTERNAL);
    } else if (cmd == '2') {
      applyAntennaLock(ANT_2_REAR_EXTERNAL);
    } else if (cmd == 'c' || cmd == 'C') {
      applyAntennaLock(ANT_CERAMIC_ONBOARD);
    } else if (cmd == 's' || cmd == 'S') {
      runWifiScan();
    }
  }

  // 2. Periodic Live RSSI Log (Every 2 seconds)
  if (millis() - lastRssiPrint >= 2000) {
    lastRssiPrint = millis();

    const char* antName = (currentAntenna == ANT_1_FRONT_EXTERNAL) ? "ANT-1 (Front Patch)" :
                          (currentAntenna == ANT_2_REAR_EXTERNAL)  ? "ANT-2 (Rear Whip)"   : "Ceramic Onboard";

    if (WiFi.status() == WL_CONNECTED) {
      int8_t rssi = WiFi.RSSI();
      int signalPercent = constrain(2 * (rssi + 100), 0, 100);

      // Signal quality bar
      char bar[11] = "----------";
      int filled = signalPercent / 10;
      for (int i = 0; i < filled && i < 10; i++) bar[i] = '#';

      Serial.printf("[RF Live] Ant: %-20s | RSSI: %3d dBm | Quality: [%s] %3d%% | BSSID: %s\n",
                    antName, rssi, bar, signalPercent, WiFi.BSSIDstr().c_str());
    } else {
      Serial.printf("[RF Live] Ant: %-20s | Wi-Fi: Disconnected (Scanning available)\n", antName);
    }
  }

  // 3. Periodic Background Wi-Fi Scan (Every 15 seconds)
  if (millis() - lastScanTime >= 15000) {
    lastScanTime = millis();
    runWifiScan();
  }

  delay(50);
}

// ============================================================================
// 6. HELPER: WI-FI ENVIRONMENT SCANNER
// ============================================================================
void runWifiScan() {
  Serial.println("\n--- [Wi-Fi Environment Scan] ---");
  int n = WiFi.scanNetworks(false, true); // Async=false, show_hidden=true
  if (n == 0) {
    Serial.println("No Wi-Fi networks discovered.");
  } else {
    Serial.printf("Discovered %d networks:\n", n);
    for (int i = 0; i < n; ++i) {
      Serial.printf("  [%02d] RSSI: %3d dBm | Ch: %2d | SSID: %-24s\n",
                    i + 1, WiFi.RSSI(i), WiFi.channel(i), WiFi.SSID(i).c_str());
    }
  }
  Serial.println("--------------------------------\n");
  WiFi.scanDelete();
}
