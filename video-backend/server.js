/**
 * server.js -- High-Performance MJPEG-to-WebSocket Video Relay & Bridge Server
 * 
 * Functions:
 * 1. Fetches multipart MJPEG frames from ESP32-C6 / ESP32-CAM nodes over HTTP/mDNS.
 * 2. Delimits JPEG binary frames (0xFFD8 SOI to 0xFFD9 EOI).
 * 3. Broadcasts raw binary JPEG frames over WebSockets (ws://localhost:8080) to connected Next.js frontends.
 * 4. Exposes HTTP REST diagnostics & health API on port 8081.
 */

const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

// ============================================================================
// CONFIGURATION
// ============================================================================
const WS_PORT = process.env.WS_PORT || 8080;
const HTTP_PORT = process.env.HTTP_PORT || 8081;

// Default node video stream sources (can be expanded for multiple soldier helmets)
const STREAM_SOURCES = {
  's3-cam': {
    id: 's3-cam',
    name: 'ESP32-S3 Helmet Cam Test (INMP441 Mic)',
    url: process.env.CAM_URL_S3 || 'http://esp32-s3-cam.local/stream',
    audioUrl: process.env.AUDIO_URL_S3 || 'http://esp32-s3-cam.local/audio',
    fallbackIpUrl: 'http://192.168.4.1/stream',
    active: true
  },
  'node-3': {
    id: 'node-3',
    name: 'ESP32-C6 Helmet Node 3',
    url: process.env.CAM_URL_NODE3 || 'http://esp32-c6-cam.local/stream',
    audioUrl: process.env.AUDIO_URL_NODE3 || 'http://esp32-c6-cam.local/audio',
    fallbackIpUrl: 'http://192.168.4.1/stream',
    active: true
  }
};

let activeStreamNode = 's3-cam';

// ============================================================================
// EXPRESS REST API (Health & Diagnostics)
// ============================================================================
const app = express();
app.use(cors());
app.use(express.json());

const streamMetrics = {
  fps: 0,
  frameCount: 0,
  bytesReceived: 0,
  lastFrameTime: null,
  connectedClients: 0,
  streamConnected: false,
  streamErrors: 0,
  targetUrl: STREAM_SOURCES[activeStreamNode].url
};

// Periodic FPS calculation
let frameCounterInterval = 0;
setInterval(() => {
  streamMetrics.fps = frameCounterInterval;
  frameCounterInterval = 0;
}, 1000);

app.get('/api/status', (req, res) => {
  res.json({
    status: streamMetrics.streamConnected ? 'online' : 'offline',
    activeNode: activeStreamNode,
    metrics: streamMetrics,
    sources: STREAM_SOURCES,
    wsEndpoint: `ws://localhost:${WS_PORT}`
  });
});

app.post('/api/select-source', (req, res) => {
  const { nodeId } = req.body;
  if (STREAM_SOURCES[nodeId]) {
    activeStreamNode = nodeId;
    streamMetrics.targetUrl = STREAM_SOURCES[nodeId].url;
    restartStreamConnection();
    return res.json({ success: true, activeNode: activeStreamNode });
  }
  res.status(400).json({ error: `Node ${nodeId} not configured with video capability.` });
});

// Proxy live PCM/WAV audio stream from ESP32 node
app.get('/api/audio-stream', (req, res) => {
  const currentSource = STREAM_SOURCES[activeStreamNode];
  if (!currentSource || !currentSource.audioUrl) {
    return res.status(404).send('Audio source not available');
  }

  res.setHeader('Content-Type', 'audio/x-raw;rate=16000;channels=1');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const proxyReq = http.get(currentSource.audioUrl, (nodeRes) => {
    nodeRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Video-Relay Audio] Error proxying audio from ${currentSource.audioUrl}:`, err.message);
    if (!res.headersSent) {
      res.status(502).send('Node audio unreachable');
    }
  });

  req.on('close', () => {
    proxyReq.destroy();
  });
});

const restServer = app.listen(HTTP_PORT, () => {
  console.log(`[Video-Relay API] Diagnostic HTTP Server listening on http://localhost:${HTTP_PORT}`);
});

// ============================================================================
// WEBSOCKET RELAY SERVER
// ============================================================================
const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`[Video-Relay WS] WebSocket Relay listening on ws://localhost:${WS_PORT}`);

wss.on('connection', (ws, req) => {
  streamMetrics.connectedClients = wss.clients.size;
  console.log(`[Video-Relay WS] Client connected from ${req.socket.remoteAddress}. Active clients: ${streamMetrics.connectedClients}`);

  // Send initial handshake metadata
  ws.send(JSON.stringify({
    type: 'STREAM_METADATA',
    nodeId: activeStreamNode,
    name: STREAM_SOURCES[activeStreamNode].name,
    fps: streamMetrics.fps,
    connected: streamMetrics.streamConnected
  }));

  ws.on('close', () => {
    streamMetrics.connectedClients = wss.clients.size;
    console.log(`[Video-Relay WS] Client disconnected. Active clients: ${streamMetrics.connectedClients}`);
  });

  ws.on('error', (err) => {
    console.error('[Video-Relay WS] Client socket error:', err.message);
  });
});

// Broadcast binary JPEG frame buffer to all connected clients
function broadcastFrame(jpegBuffer) {
  frameCounterInterval++;
  streamMetrics.frameCount++;
  streamMetrics.bytesReceived += jpegBuffer.length;
  streamMetrics.lastFrameTime = Date.now();

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jpegBuffer, { binary: true });
    }
  });
}

// ============================================================================
// CAMERA STREAM INGESTION & DELIMITATION (SOI/EOI Extraction)
// ============================================================================
let currentReq = null;
let reconnectTimer = null;

function connectToCamStream() {
  const targetUrl = STREAM_SOURCES[activeStreamNode].url;
  console.log(`[Video-Relay Ingest] Connecting to MJPEG stream at: ${targetUrl}...`);

  try {
    currentReq = http.get(targetUrl, { timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) {
        console.error(`[Video-Relay Ingest] Failed to connect, HTTP Status: ${res.statusCode}`);
        scheduleReconnect();
        return;
      }

      console.log(`[Video-Relay Ingest] Connected successfully to camera stream (HTTP ${res.statusCode})`);
      streamMetrics.streamConnected = true;

      let buffer = Buffer.alloc(0);

      res.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        // Scan buffer for JPEG Start of Image (0xFFD8) and End of Image (0xFFD9)
        while (true) {
          const startIndex = buffer.indexOf(Buffer.from([0xFF, 0xD8]));
          if (startIndex === -1) {
            // No SOI found, discard leading noise if buffer is too large
            if (buffer.length > 65536) buffer = buffer.subarray(buffer.length - 1024);
            break;
          }

          const endIndex = buffer.indexOf(Buffer.from([0xFF, 0xD9]), startIndex + 2);
          if (endIndex === -1) {
            // Partial frame; wait for next chunk
            if (startIndex > 0) buffer = buffer.subarray(startIndex);
            break;
          }

          // Complete JPEG frame extracted
          const jpegFrame = buffer.subarray(startIndex, endIndex + 2);
          buffer = buffer.subarray(endIndex + 2);

          broadcastFrame(jpegFrame);
        }
      });

      res.on('end', () => {
        console.warn('[Video-Relay Ingest] Camera stream ended.');
        streamMetrics.streamConnected = false;
        scheduleReconnect();
      });

      res.on('error', (err) => {
        console.error('[Video-Relay Ingest] Stream error:', err.message);
        streamMetrics.streamConnected = false;
        streamMetrics.streamErrors++;
        scheduleReconnect();
      });
    });

    currentReq.on('error', (err) => {
      console.error(`[Video-Relay Ingest] HTTP Connection Error (${targetUrl}):`, err.message);
      streamMetrics.streamConnected = false;
      streamMetrics.streamErrors++;
      scheduleReconnect();
    });

    currentReq.on('timeout', () => {
      console.warn('[Video-Relay Ingest] Request timed out.');
      currentReq.destroy();
      streamMetrics.streamConnected = false;
      scheduleReconnect();
    });

  } catch (err) {
    console.error('[Video-Relay Ingest] Exception during stream connect:', err.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectToCamStream();
  }, 3000);
}

function restartStreamConnection() {
  if (currentReq) {
    try { currentReq.destroy(); } catch (e) {}
  }
  if (reconnectTimer) clearTimeout(reconnectTimer);
  connectToCamStream();
}

// Watchdog: If no frames received in 8 seconds while marked connected, force reconnect
setInterval(() => {
  if (streamMetrics.streamConnected && streamMetrics.lastFrameTime) {
    if (Date.now() - streamMetrics.lastFrameTime > 8000) {
      console.warn('[Video-Relay Watchdog] Stream froze (no frames in 8s). Restarting connection...');
      streamMetrics.streamConnected = false;
      restartStreamConnection();
    }
  }
}, 5000);

// Start ingestion on launch
connectToCamStream();
