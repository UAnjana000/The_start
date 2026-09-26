# Tactical Helmet Video Relay & WebSocket Bridge

This backend server bridges raw MJPEG HTTP video streams from **ESP32-C6 / ESP32-CAM** helmet nodes directly into the Next.js Command Center frontend over high-throughput WebSockets.

---

### Architecture

```
[ESP32-C6 Helmet Cam] 
      │ (MJPEG Stream: http://esp32-c6-cam.local/stream)
      ▼
[Node.js Video Relay Server (server.js)]
      │ (Binary JPEG WebSocket: ws://localhost:8080)
      │ (REST Diagnostics API: http://localhost:8081/api/status)
      ▼
[Next.js Tactical Dashboard UI (HTML5 Canvas)]
```

---

### Quick Start

1. **Install Dependencies:**
   ```bash
   cd video-backend
   npm install
   ```

2. **Start the Relay Server:**
   ```bash
   npm start
   ```

3. **Endpoints:**
   - **WebSocket Stream**: `ws://localhost:8080` (Broadcasts binary JPEG buffers)
   - **REST Status API**: `http://localhost:8081/api/status`
   - **Switch Active Camera Source**: `POST http://localhost:8081/api/select-source` with JSON `{ "nodeId": "node-3" }`
