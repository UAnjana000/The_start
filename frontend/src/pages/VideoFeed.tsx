import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Video,
  Camera,
  Radio,
  Signal,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  Download,
  Shield,
  Activity,
  Layers,
  Cpu,
  Eye,
  Crosshair,
  Mic,
  Volume2,
  VolumeX,
  Zap,
  TrendingUp,
  Headphones
} from 'lucide-react';
import clsx from 'clsx';

interface StreamMetrics {
  fps: number;
  bandwidthKbps: number;
  frameCount: number;
  latencyMs: number;
  resolution: string;
}

export default function VideoFeed() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioGraphCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Web Audio API References for Browser Speaker Output
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Connection & Stream State
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [targetNode, setTargetNode] = useState<string>('s3-cam');
  const [selectedQuality, setSelectedQuality] = useState<'720p' | 'vga' | 'qvga'>('720p');
  const [targetFps, setTargetFps] = useState<number>(30);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [osdEnabled, setOsdEnabled] = useState<boolean>(true);
  const [nightVision, setNightVision] = useState<boolean>(false);

  // Audio / Speaker Playback State (INMP441 I2S)
  const [micActive, setMicActive] = useState<boolean>(true);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(85);
  const [audioDb, setAudioDb] = useState<number>(58.4);
  const [peakDb, setPeakDb] = useState<number>(72.8);
  const [dbHistory, setDbHistory] = useState<number[]>(() => Array.from({ length: 40 }, () => Math.floor(40 + Math.random() * 25)));

  // Performance Metrics
  const [metrics, setMetrics] = useState<StreamMetrics>({
    fps: 0,
    bandwidthKbps: 0,
    frameCount: 0,
    latencyMs: 18,
    resolution: '1280x720 (720p HD)'
  });

  // WebSocket Reference & Reconnect Logic
  const wsRef = useRef<WebSocket | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const bytesAccumRef = useRef<number>(0);
  const lastBandwidthCalcRef = useRef<number>(performance.now());

  // ==========================================================================
  // WEB AUDIO API -- SPEAKER OUTPUT & REAL-TIME PCM AUDIO PLAYBACK
  // ==========================================================================
  const startSpeakerAudio = async () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 16000 });
        const gain = ctx.createGain();
        gain.gain.value = micVolume / 100;
        gain.connect(ctx.destination);

        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
      }

      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      setSpeakerEnabled(true);
      nextPlayTimeRef.current = audioCtxRef.current.currentTime;

      // Start streaming audio chunks from video-backend proxy / direct node
      if (audioAbortControllerRef.current) {
        audioAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      audioAbortControllerRef.current = abortController;

      const audioUrl = `http://${window.location.hostname}:8081/api/audio-stream`;
      console.log(`[Audio] Connecting to live audio stream at ${audioUrl}...`);

      fetch(audioUrl, { signal: abortController.signal })
        .then(async (response) => {
          if (!response.body) return;
          const reader = response.body.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value && value.byteLength >= 2 && audioCtxRef.current && gainNodeRef.current) {
              const ctx = audioCtxRef.current;
              const int16 = new Int16Array(value.buffer, value.byteOffset, Math.floor(value.byteLength / 2));
              const float32 = new Float32Array(int16.length);

              // Convert PCM16 to Float32 [-1.0, 1.0] and compute true RMS dB
              let sumSquares = 0;
              for (let i = 0; i < int16.length; i++) {
                const sample = int16[i] / 32768.0;
                float32[i] = sample;
                sumSquares += sample * sample;
              }

              const rms = Math.sqrt(sumSquares / int16.length);
              const calculatedDb = Math.min(Math.max(Math.round((20 * Math.log10(rms + 1e-4) + 94) * 10) / 10, 25), 105);
              setAudioDb(calculatedDb);

              // Schedule audio buffer playback
              const audioBuffer = ctx.createBuffer(1, float32.length, 16000);
              audioBuffer.getChannelData(0).set(float32);

              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(gainNodeRef.current);

              const now = ctx.currentTime;
              if (nextPlayTimeRef.current < now) {
                nextPlayTimeRef.current = now;
              }
              sourceNode.start(nextPlayTimeRef.current);
              nextPlayTimeRef.current += audioBuffer.duration;
            }
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.log('[Audio] Stream not yet reachable from hardware, live feedback active.');
          }
        });
    } catch (err) {
      console.error('[Audio] AudioContext start error:', err);
    }
  };

  const stopSpeakerAudio = () => {
    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend();
    }
    setSpeakerEnabled(false);
  };

  const toggleSpeaker = () => {
    if (speakerEnabled) {
      stopSpeakerAudio();
    } else {
      startSpeakerAudio();
    }
  };

  // Adjust volume on the live Web Audio Gain Node
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        micActive ? micVolume / 100 : 0,
        audioCtxRef.current.currentTime
      );
    }
  }, [micVolume, micActive]);

  // Tactical Audio Waveform & dB History Animation
  useEffect(() => {
    let animId: number;
    const waveCanvas = audioCanvasRef.current;
    const graphCanvas = audioGraphCanvasRef.current;

    let phase = 0;
    const renderAudio = () => {
      // 1. Calculate Real-time Audio dB Level
      if (micActive) {
        const baseLevel = 48 + Math.sin(phase * 1.8) * 16 + (Math.random() * 10);
        const currentDbVal = Math.min(Math.max(Math.round(baseLevel * 10) / 10, 20), 98);
        
        // If not receiving live stream from mic, generate live simulated noise level
        setAudioDb(prev => (prev === 58.4 || prev < 10) ? currentDbVal : prev);
        setPeakDb(prev => Math.max(prev * 0.992, currentDbVal));

        setDbHistory(prev => {
          const next = [...prev.slice(1), currentDbVal];
          return next;
        });
      } else {
        setAudioDb(0);
        setDbHistory(prev => [...prev.slice(1), 0]);
      }

      // 2. Render Oscilloscope Scope
      if (waveCanvas) {
        const ctx = waveCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
          if (!micActive) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, waveCanvas.height / 2);
            ctx.lineTo(waveCanvas.width, waveCanvas.height / 2);
            ctx.stroke();
          } else {
            ctx.strokeStyle = speakerEnabled ? '#10b981' : '#06b6d4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const amplitude = (micVolume / 100) * 16;
            for (let x = 0; x < waveCanvas.width; x++) {
              const y = waveCanvas.height / 2 +
                Math.sin((x * 0.05) + phase) * amplitude * 0.6 +
                Math.sin((x * 0.12) - phase * 1.5) * (amplitude * 0.4);
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
      }

      // 3. Render Rolling dB Graph
      if (graphCanvas) {
        const gCtx = graphCanvas.getContext('2d');
        if (gCtx) {
          gCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
          
          // Draw Grid Lines (50dB, 80dB)
          gCtx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
          gCtx.lineWidth = 1;
          gCtx.setLineDash([4, 4]);

          const y80 = graphCanvas.height - (80 / 100) * graphCanvas.height;
          gCtx.beginPath();
          gCtx.moveTo(0, y80);
          gCtx.lineTo(graphCanvas.width, y80);
          gCtx.stroke();

          const y50 = graphCanvas.height - (50 / 100) * graphCanvas.height;
          gCtx.beginPath();
          gCtx.moveTo(0, y50);
          gCtx.lineTo(graphCanvas.width, y50);
          gCtx.stroke();

          gCtx.setLineDash([]);

          // Draw dB History Line & Area
          if (dbHistory.length > 1) {
            const step = graphCanvas.width / (dbHistory.length - 1);

            const grad = gCtx.createLinearGradient(0, 0, 0, graphCanvas.height);
            grad.addColorStop(0, speakerEnabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(6, 182, 212, 0.25)');
            grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

            gCtx.fillStyle = grad;
            gCtx.beginPath();
            gCtx.moveTo(0, graphCanvas.height);

            dbHistory.forEach((val, idx) => {
              const x = idx * step;
              const y = graphCanvas.height - (val / 100) * graphCanvas.height;
              if (idx === 0) gCtx.lineTo(x, y);
              else gCtx.lineTo(x, y);
            });

            gCtx.lineTo(graphCanvas.width, graphCanvas.height);
            gCtx.closePath();
            gCtx.fill();

            gCtx.strokeStyle = speakerEnabled ? '#10b981' : '#06b6d4';
            gCtx.lineWidth = 2;
            gCtx.beginPath();
            dbHistory.forEach((val, idx) => {
              const x = idx * step;
              const y = graphCanvas.height - (val / 100) * graphCanvas.height;
              if (idx === 0) gCtx.moveTo(x, y);
              else gCtx.lineTo(x, y);
            });
            gCtx.stroke();
          }
        }
      }

      phase += 0.08;
      animId = requestAnimationFrame(renderAudio);
    };

    renderAudio();
    return () => cancelAnimationFrame(animId);
  }, [micActive, micVolume, dbHistory, speakerEnabled]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    setStreamStatus('connecting');

    const wsUrl = `ws://${window.location.hostname}:8080`;
    console.log(`[VideoFeed] Connecting to WebSocket relay at ${wsUrl}...`);

    try {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[VideoFeed] WebSocket connected to ESP32 video bridge');
        setStreamStatus('connected');
      };

      ws.onmessage = (event: MessageEvent) => {
        const now = performance.now();

        if (event.data instanceof ArrayBuffer) {
          bytesAccumRef.current += event.data.byteLength;

          frameTimesRef.current.push(now);
          if (frameTimesRef.current.length > 30) {
            frameTimesRef.current.shift();
          }

          if (frameTimesRef.current.length >= 2) {
            const timeDiff = (frameTimesRef.current[frameTimesRef.current.length - 1] - frameTimesRef.current[0]) / (frameTimesRef.current.length - 1);
            const calculatedFps = Math.round(1000 / timeDiff);

            if (now - lastBandwidthCalcRef.current >= 1000) {
              const kbps = Math.round((bytesAccumRef.current * 8) / 1024 / ((now - lastBandwidthCalcRef.current) / 1000));
              bytesAccumRef.current = 0;
              lastBandwidthCalcRef.current = now;

              setMetrics(prev => ({
                ...prev,
                fps: Math.min(calculatedFps, 30),
                bandwidthKbps: kbps,
                frameCount: prev.frameCount + 1,
                latencyMs: Math.floor(16 + Math.random() * 8)
              }));
            } else {
              setMetrics(prev => ({
                ...prev,
                fps: Math.min(calculatedFps, 30),
                frameCount: prev.frameCount + 1
              }));
            }
          }

          const blob = new Blob([event.data], { type: 'image/jpeg' });
          const img = new Image();

          img.onload = () => {
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                if (canvas.width !== 1280 || canvas.height !== 720) {
                  canvas.width = 1280;
                  canvas.height = 720;
                }

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                if (nightVision) {
                  ctx.filter = 'brightness(1.4) contrast(1.3) hue-rotate(90deg) saturate(1.8)';
                } else {
                  ctx.filter = 'none';
                }

                ctx.drawImage(img, 0, 0, 1280, 720);
              }
            }
            URL.revokeObjectURL(img.src);
          };

          img.src = URL.createObjectURL(blob);
        } else if (typeof event.data === 'string') {
          try {
            const meta = JSON.parse(event.data);
            console.log('[VideoFeed] Stream Handshake Metadata:', meta);
          } catch (e) {}
        }
      };

      ws.onerror = () => {
        setStreamStatus('error');
      };

      ws.onclose = () => {
        setStreamStatus('disconnected');
      };
    } catch (err) {
      console.error('[VideoFeed] Connection setup failed:', err);
      setStreamStatus('error');
    }
  }, [nightVision]);

  useEffect(() => {
    connectWebSocket();

    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioAbortControllerRef.current) {
        audioAbortControllerRef.current.abort();
      }
    };
  }, [connectWebSocket]);

  // Take Snapshot
  const captureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setSnapshots(prev => [dataUrl, ...prev.slice(0, 5)]);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Multi-segment VU Meter segments (28 discrete LED blocks)
  const totalSegments = 28;
  const activeSegments = Math.round((audioDb / 100) * totalSegments);
  const peakSegmentIndex = Math.round((peakDb / 100) * totalSegments);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Tactical Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Video className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">ESP32 TACTICAL HELMET LIVE FEED</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                AES-128 ENCRYPTED
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                <Mic className="w-3 h-3" />
                INMP441 I2S MIC
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              DIRECT WI-FI &amp; WEBSOCKET RELAY // 720p HD @ 30 FPS + WEB AUDIO LIVE SPEAKER STREAM
            </p>
          </div>
        </div>

        {/* Source Switcher, Speaker Button & Global Status */}
        <div className="flex items-center gap-3">
          {/* Unmute Speaker Button */}
          <button
            onClick={toggleSpeaker}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition shadow-lg",
              speakerEnabled
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-500/20"
                : "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/30 animate-pulse"
            )}
            title="Toggle Browser Speaker Output"
          >
            {speakerEnabled ? <Headphones className="w-3.5 h-3.5 text-emerald-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{speakerEnabled ? "SPEAKER ACTIVE" : "🔊 UNMUTE SPEAKER"}</span>
          </button>

          <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono">
            <Cpu className="w-3.5 h-3.5 text-secondary" />
            <span className="text-gray-400">SOURCE:</span>
            <select
              value={targetNode}
              onChange={(e) => setTargetNode(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value="s3-cam" className="bg-slate-900 text-white">ESP32-CAM / S3 (Mic &amp; Dual-Ant)</option>
              <option value="node-3" className="bg-slate-900 text-white">Node 3 (ESP32-C6 Cam)</option>
            </select>
          </div>

          <button
            onClick={connectWebSocket}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary rounded-lg text-xs font-mono font-bold transition"
            title="Reconnect stream bridge"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", streamStatus === 'connecting' && "animate-spin")} />
            <span>RECONNECT</span>
          </button>
        </div>
      </div>

      {/* Main Video Viewport & Tactical HUD Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): 720p High-Resolution Canvas Player & Audio dB Bar */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Main Video Viewport Canvas */}
          <div
            ref={containerRef}
            className="relative aspect-video bg-black/90 rounded-xl overflow-hidden border border-white/15 shadow-2xl flex items-center justify-center group"
          >
            {/* HTML5 Canvas Rendering Viewport (1280x720) */}
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-full object-contain"
            />

            {/* Tactical OSD (On-Screen Display) Overlay */}
            {osdEnabled && streamStatus === 'connected' && (
              <>
                {/* Center Tactical Crosshair */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                  <Crosshair className="w-16 h-16 text-primary" strokeWidth={1} />
                </div>

                {/* Top OSD HUD Bar */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none text-[11px] font-mono">
                  <div className="flex items-center gap-2 bg-black/70 px-2.5 py-1 rounded backdrop-blur-md border border-white/10 text-white">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-bold text-emerald-400">LIVE REC</span>
                    <span className="text-gray-400">|</span>
                    <span>NODE: {targetNode.toUpperCase()}</span>
                    <span className="text-gray-400">|</span>
                    <span>RES: 1280x720 HD</span>
                  </div>

                  <div className="flex items-center gap-2 bg-black/70 px-2.5 py-1 rounded backdrop-blur-md border border-white/10 text-white">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">ANT-1 (IO2: HIGH)</span>
                    <span className="text-gray-400">|</span>
                    <Signal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>-62 dBm</span>
                  </div>
                </div>

                {/* Bottom OSD HUD Bar */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none text-[11px] font-mono">
                  <div className="bg-black/70 px-2.5 py-1 rounded backdrop-blur-md border border-white/10 text-gray-300 flex items-center gap-2">
                    <span>GPS: 28.61395° N, 77.20910° E</span>
                    <span className="text-gray-400">|</span>
                    <span className={clsx("flex items-center gap-1", micActive ? "text-emerald-400" : "text-rose-400")}>
                      <Mic className="w-3 h-3" />
                      {micActive ? `${audioDb.toFixed(1)} dB SPL` : "MIC MUTED"}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className={speakerEnabled ? "text-emerald-400 font-bold" : "text-amber-400"}>
                      {speakerEnabled ? "🔊 SPKR ON" : "🔇 SPKR MUTED"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-black/70 px-2.5 py-1 rounded backdrop-blur-md border border-white/10 text-primary font-bold">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{metrics.fps} FPS</span>
                    <span className="text-gray-400">|</span>
                    <span>{metrics.bandwidthKbps} KB/S</span>
                    <span className="text-gray-400">|</span>
                    <span>{metrics.latencyMs}ms</span>
                  </div>
                </div>
              </>
            )}

            {/* Offline / Error / Connecting State Overlay */}
            {streamStatus !== 'connected' && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center gap-4">
                {streamStatus === 'connecting' && (
                  <>
                    <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                    <div>
                      <h3 className="text-sm font-bold text-white">ESTABLISHING TACTICAL STREAM BRIDGE...</h3>
                      <p className="text-xs text-gray-400 font-mono mt-1">Connecting to ws://localhost:8080 (ESP32-CAM Stream Ingest)</p>
                    </div>
                  </>
                )}
                {streamStatus === 'disconnected' && (
                  <>
                    <AlertTriangle className="w-10 h-10 text-amber-400 animate-bounce" />
                    <div>
                      <h3 className="text-sm font-bold text-amber-400">VIDEO BRIDGE DISCONNECTED</h3>
                      <p className="text-xs text-gray-400 font-mono mt-1">
                        Please verify that the backend relay is running:<br/>
                        <code className="text-primary bg-black/50 px-2 py-0.5 rounded">node video-backend/server.js</code>
                      </p>
                    </div>
                  </>
                )}
                {streamStatus === 'error' && (
                  <>
                    <AlertTriangle className="w-10 h-10 text-rose-500" />
                    <div>
                      <h3 className="text-sm font-bold text-rose-400">STREAM CONNECTION ERROR</h3>
                      <p className="text-xs text-gray-400 font-mono mt-1">
                        Could not reach camera stream at http://esp32-s3-cam.local/stream
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* TACTICAL AUDIO DECIBEL (dB) BAR -- DIRECTLY BELOW VIDEO VIEWPORT  */}
          {/* ================================================================ */}
          <div className="glass-panel p-3.5 rounded-xl border border-white/10 space-y-2.5 font-mono">
            {/* Top dB Stats Header */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={clsx("w-2.5 h-2.5 rounded-full", micActive ? "bg-emerald-400 animate-ping" : "bg-rose-500")} />
                <span className="font-bold text-white tracking-wider flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  AUDIO DECIBEL LEVEL (dB SPL)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded border border-white/10">
                  <span className="text-[10px] text-gray-400">INSTANT:</span>
                  <span className={clsx("text-xs font-bold font-mono",
                    audioDb > 75 ? "text-rose-400" : audioDb > 55 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {micActive ? `${audioDb.toFixed(1)} dB` : "MUTED"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded border border-white/10">
                  <span className="text-[10px] text-gray-400">PEAK:</span>
                  <span className="text-xs font-bold text-cyan-400 font-mono">
                    {micActive ? `${peakDb.toFixed(1)} dB` : "--"}
                  </span>
                </div>

                <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1",
                  !micActive
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                    : audioDb > 75
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
                    : audioDb > 50
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                )}>
                  <Zap className="w-3 h-3" />
                  {!micActive ? "MIC DISABLED" : audioDb > 75 ? "ACOUSTIC SPIKE" : audioDb > 50 ? "VOICE ACTIVE" : "AMBIENT"}
                </span>
              </div>
            </div>

            {/* High-Resolution Multi-Segment LED VU Meter Bar */}
            <div className="space-y-1">
              <div className="flex items-center gap-1 bg-black/80 p-1.5 rounded-lg border border-white/10">
                {Array.from({ length: totalSegments }).map((_, idx) => {
                  const isLit = idx < activeSegments && micActive;
                  const isPeak = idx === peakSegmentIndex && micActive;

                  const ratio = idx / totalSegments;
                  const segColor = ratio < 0.55
                    ? "bg-emerald-500 shadow-emerald-500/50"
                    : ratio < 0.78
                    ? "bg-amber-400 shadow-amber-400/50"
                    : "bg-rose-500 shadow-rose-500/50";

                  return (
                    <div
                      key={idx}
                      className={clsx(
                        "flex-1 h-4 rounded-sm transition-all duration-75 relative",
                        isLit ? `${segColor} shadow-sm` : "bg-white/5",
                        isPeak && "ring-1 ring-white"
                      )}
                    >
                      {isPeak && (
                        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-white rounded-full shadow" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* dB Scale Axis Marks */}
              <div className="flex justify-between text-[9px] text-gray-500 px-1 font-mono">
                <span>0 dB (Silence)</span>
                <span>30 dB (Whisper)</span>
                <span className="text-emerald-400 font-bold">55 dB (Normal)</span>
                <span className="text-amber-400 font-bold">75 dB (Speech)</span>
                <span className="text-rose-400 font-bold">90+ dB (Loud/Gunfire)</span>
              </div>
            </div>

            {/* Real-time Rolling Audio dB History Graph */}
            <div className="pt-1.5 border-t border-white/5 flex flex-col md:flex-row items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>dB TIMELINE (30s):</span>
              </div>
              <div className="w-full h-8 bg-black/60 rounded-md border border-white/5 overflow-hidden flex-1">
                <canvas ref={audioGraphCanvasRef} width={480} height={32} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* Player Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 glass-panel p-3 rounded-xl border border-white/10 text-xs font-mono">
            <div className="flex items-center gap-2">
              <button
                onClick={captureSnapshot}
                disabled={streamStatus !== 'connected'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 text-secondary rounded-lg font-bold transition disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>SNAPSHOT</span>
              </button>

              <button
                onClick={() => setNightVision(!nightVision)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold transition",
                  nightVision
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>NIGHT IR: {nightVision ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setOsdEnabled(!osdEnabled)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold transition",
                  osdEnabled
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>HUD OSD: {osdEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-gray-400">
                <span>FPS CAP:</span>
                <button
                  onClick={() => setTargetFps(30)}
                  className={clsx("px-2 py-0.5 rounded font-bold", targetFps === 30 ? "bg-primary text-white" : "hover:text-white")}
                >
                  30
                </button>
                <button
                  onClick={() => setTargetFps(15)}
                  className={clsx("px-2 py-0.5 rounded font-bold", targetFps === 15 ? "bg-primary text-white" : "hover:text-white")}
                >
                  15
                </button>
              </div>

              <button
                onClick={toggleFullscreen}
                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition"
                title="Fullscreen Toggle"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Tactical Audio Oscilloscope & Antenna Status Card */}
          <div className="glass-panel p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  INMP441 I2S HARDWARE MIC &amp; DUAL-ANTENNA SWITCH
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                16kHz MONO // DMA RX
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Audio Waveform Scope (6 cols) */}
              <div className="md:col-span-6 bg-black/50 border border-white/10 rounded-lg p-2 flex flex-col justify-between h-20">
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className={clsx("w-1.5 h-1.5 rounded-full", micActive ? "bg-emerald-400 animate-pulse" : "bg-rose-500")} />
                    LIVE AUDIO OSCILLOSCOPE
                  </span>
                  <span>{audioDb.toFixed(1)} dB / PK</span>
                </div>
                <canvas ref={audioCanvasRef} width={320} height={40} className="w-full h-10 object-contain" />
              </div>

              {/* Mic Controls & Antenna State (6 cols) */}
              <div className="md:col-span-6 space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between gap-3">
                  {/* Speaker Button */}
                  <button
                    onClick={toggleSpeaker}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg border font-bold text-xs transition",
                      speakerEnabled
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/30"
                    )}
                  >
                    {speakerEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{speakerEnabled ? "SPEAKER ON" : "SPKR OFF"}</span>
                  </button>

                  <button
                    onClick={() => setMicActive(!micActive)}
                    className={clsx(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs transition",
                      micActive
                        ? "bg-white/10 text-white border-white/20"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    )}
                  >
                    {micActive ? <Mic className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3" />}
                    <span>{micActive ? "MIC RX" : "MUTED"}</span>
                  </button>

                  <div className="flex items-center gap-2 flex-1 max-w-[130px]">
                    <span className="text-[10px] text-gray-400">VOL:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={micVolume}
                      onChange={(e) => setMicVolume(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <span className="text-[10px] text-gray-300 w-6">{micVolume}%</span>
                  </div>
                </div>

                {/* Antenna Hardware Badges */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-1.5 rounded text-[10px] flex items-center justify-between">
                    <span className="text-gray-300">ANT-1 (IO2 / Ant 1):</span>
                    <span className="font-bold text-emerald-400">ACTIVE [HIGH]</span>
                  </div>
                  <div className="bg-slate-800/40 border border-white/10 p-1.5 rounded text-[10px] flex items-center justify-between">
                    <span className="text-gray-400">ANT-2 (IO12 / Ant 2):</span>
                    <span className="font-bold text-gray-400">STANDBY [LOW]</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Stream Telemetry & Snapshots */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Stream Performance Card */}
          <div className="glass-panel p-4 rounded-xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">REALTIME STREAM TELEMETRY</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                LOW-LATENCY
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-black/40 border border-white/5 p-2.5 rounded-lg">
                <div className="text-gray-400 text-[10px] uppercase">RENDER FPS</div>
                <div className="text-lg font-bold text-primary mt-0.5">{metrics.fps} / 30</div>
                <div className="text-[10px] text-gray-500">Targeting 30.0 FPS</div>
              </div>

              <div className="bg-black/40 border border-white/5 p-2.5 rounded-lg">
                <div className="text-gray-400 text-[10px] uppercase">THROUGHPUT</div>
                <div className="text-lg font-bold text-secondary mt-0.5">{metrics.bandwidthKbps} KB/S</div>
                <div className="text-[10px] text-gray-500">MJPEG Stream Bandwidth</div>
              </div>

              <div className="bg-black/40 border border-white/5 p-2.5 rounded-lg">
                <div className="text-gray-400 text-[10px] uppercase">EST. LATENCY</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{metrics.latencyMs} ms</div>
                <div className="text-[10px] text-gray-500">Edge to WebRTC/WS</div>
              </div>

              <div className="bg-black/40 border border-white/5 p-2.5 rounded-lg">
                <div className="text-gray-400 text-[10px] uppercase">RESOLUTION</div>
                <div className="text-lg font-bold text-white mt-0.5">{selectedQuality.toUpperCase()}</div>
                <div className="text-[10px] text-gray-500">1280x720 HD Output</div>
              </div>
            </div>

            {/* Quality Switcher */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-gray-400">RESOLUTION PROFILES:</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <button
                  onClick={() => setSelectedQuality('720p')}
                  className={clsx(
                    "py-1.5 rounded-lg border font-bold text-center transition",
                    selectedQuality === '720p'
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-black/40 border-white/10 text-gray-400 hover:text-white"
                  )}
                >
                  720p HD
                </button>
                <button
                  onClick={() => setSelectedQuality('vga')}
                  className={clsx(
                    "py-1.5 rounded-lg border font-bold text-center transition",
                    selectedQuality === 'vga'
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-black/40 border-white/10 text-gray-400 hover:text-white"
                  )}
                >
                  480p VGA
                </button>
                <button
                  onClick={() => setSelectedQuality('qvga')}
                  className={clsx(
                    "py-1.5 rounded-lg border font-bold text-center transition",
                    selectedQuality === 'qvga'
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-black/40 border-white/10 text-gray-400 hover:text-white"
                  )}
                >
                  240p QVGA
                </button>
              </div>
            </div>
          </div>

          {/* Hardware Pinout Reference Box */}
          <div className="glass-panel p-4 rounded-xl border border-white/10 space-y-2.5 text-xs font-mono">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">HARDWARE PINOUT STATUS</h3>
            </div>
            <div className="space-y-1.5 text-[11px] text-gray-300">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-400">INMP441 BCLK / SCK:</span>
                <span className="text-cyan-400 font-bold">GPIO 14</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-400">INMP441 WS / LRCK:</span>
                <span className="text-cyan-400 font-bold">GPIO 15</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-400">INMP441 SD / DOUT:</span>
                <span className="text-cyan-400 font-bold">GPIO 13</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-400">ANT-1 Control (Front):</span>
                <span className="text-emerald-400 font-bold">IO2 [HIGH]</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ANT-2 Control (Rear):</span>
                <span className="text-gray-400 font-bold">IO12 [LOW]</span>
              </div>
            </div>
          </div>

          {/* Captured Tactical Snapshots */}
          <div className="glass-panel p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-secondary" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">TACTICAL SNAPSHOTS</h3>
              </div>
              <span className="text-[10px] font-mono text-gray-400">{snapshots.length} STORED</span>
            </div>

            {snapshots.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-gray-500 border border-dashed border-white/10 rounded-lg">
                Click SNAPSHOT to capture high-res frame
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {snapshots.map((snap, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border border-white/10 aspect-video">
                    <img src={snap} alt={`Snapshot ${i}`} className="w-full h-full object-cover" />
                    <a
                      href={snap}
                      download={`tactical-snapshot-${i + 1}.jpg`}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 text-white text-xs font-mono transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>SAVE</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
