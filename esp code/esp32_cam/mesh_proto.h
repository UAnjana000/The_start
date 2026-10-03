#ifndef MESH_PROTO_H
#define MESH_PROTO_H

#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include "mbedtls/aes.h"

// ============================================================================
// PROTOCOL CONSTANTS & MAGIC
// ============================================================================
#define MESH_MAGIC       0x4D45   // 'ME'
#define MESH_VER         2        // Protocol v2 with AES-128 & Dynamic Topology
#define AES_BLOCK_SIZE   16
#define MAX_NODES_TRACK  16

// 128-bit (16-byte) Pre-Shared Key (PSK) for Tactical Mesh Encryption
static const uint8_t MESH_AES_KEY[16] = {
  0x2B, 0x7E, 0x15, 0x16, 0x28, 0xAE, 0xD2, 0xA6,
  0xAB, 0xF7, 0x15, 0x88, 0x09, 0xCF, 0x4F, 0x3C
};

// Fixed Initialization Vector (IV) / Nonce for CBC Mode
static const uint8_t MESH_AES_IV[16] = {
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F
};

// ============================================================================
// PACKET PAYLOAD STRUCTURE (Must be a multiple of 16 bytes for AES-128-CBC)
// ============================================================================
typedef struct __attribute__((packed)) {
  uint16_t magic;         // MESH_MAGIC (0x4D45)
  uint8_t  ver;           // MESH_VER (2)
  uint8_t  srcId;         // Node ID (1, 2, 3...)
  uint8_t  ttl;           // Hop budget (starts at 3, decremented per relay)
  uint8_t  hops;          // Number of hops traversed
  uint16_t seq;           // Monotonically increasing sequence number
  float    lat;           // GPS Latitude
  float    lon;           // GPS Longitude
  int8_t   rssiNode;      // Node's measured RSSI to gateway beacon
  uint8_t  antenna;       // Active antenna index (1 = Front/Patch, 2 = Rear/Whip, 0 = Omni)
  uint8_t  bestRelayId;   // Preferred ad-hoc next-hop relay ID
  int8_t   linkRssi;      // RSSI of the best relay link
  uint8_t  hasVideo;      // 1 if node has active camera / video stream capability
  uint8_t  padding[11];   // Zero-padding to align struct to 32 bytes (2 x AES blocks)
} MeshPacket;

// Enforce 32-byte alignment at compile-time for AES-CBC
static_assert(sizeof(MeshPacket) == 32, "MeshPacket size must be 32 bytes for AES-128 alignment");

// ============================================================================
// GATEWAY TRACKING STRUCTURES
// ============================================================================
typedef struct {
  MeshPacket p;
  int8_t     rssiGw;      // Gateway direct RX RSSI
  uint32_t   rxTimestamp; // Local millis() at reception
} RxItem;

typedef struct {
  bool     used;
  bool     seenOnce;
  bool     dirty;
  uint8_t  id;
  uint16_t seq;
  uint8_t  hops;
  float    lat;
  float    lon;
  int8_t   rssiNode;
  int8_t   rssiGw;
  uint8_t  antenna;
  uint8_t  bestRelayId;
  int8_t   linkRssi;
  uint8_t  hasVideo;
  uint32_t lastMs;
} NodeRec;

// ============================================================================
// AES-128 ENCRYPTION & DECRYPTION UTILITIES
// ============================================================================
static inline bool encryptMeshPacket(const MeshPacket* in, uint8_t* outBuf) {
  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  
  if (mbedtls_aes_setkey_enc(&aes, MESH_AES_KEY, 128) != 0) {
    mbedtls_aes_free(&aes);
    return false;
  }

  uint8_t iv[16];
  memcpy(iv, MESH_AES_IV, 16);

  int ret = mbedtls_aes_crypt_cbc(&aes, MBEDTLS_AES_ENCRYPT, sizeof(MeshPacket), iv, (const unsigned char*)in, outBuf);
  mbedtls_aes_free(&aes);
  return (ret == 0);
}

static inline bool decryptMeshPacket(const uint8_t* inBuf, size_t inLen, MeshPacket* out) {
  if (inLen != sizeof(MeshPacket)) return false;

  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  
  if (mbedtls_aes_setkey_dec(&aes, MESH_AES_KEY, 128) != 0) {
    mbedtls_aes_free(&aes);
    return false;
  }

  uint8_t iv[16];
  memcpy(iv, MESH_AES_IV, 16);

  int ret = mbedtls_aes_crypt_cbc(&aes, MBEDTLS_AES_DECRYPT, sizeof(MeshPacket), iv, inBuf, (unsigned char*)out);
  mbedtls_aes_free(&aes);

  if (ret != 0) return false;
  return (out->magic == MESH_MAGIC && out->ver == MESH_VER);
}

#endif // MESH_PROTO_H
