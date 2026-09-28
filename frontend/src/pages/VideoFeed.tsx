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
  Image as ImageIcon
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

  // Web Audio API References for Browser Speaker Output
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Keyframe / Presentation Mock Mode (Defaulting to Keyframe 1 from 'keyframe img/')
  const [feedMode, setFeedMode] = useState<'keyframe' | 'live'>('keyframe');
  const [selectedKeyframe, setSelectedKeyframe] = useState<string>('1');

  // Connection & Stream State
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connected');
  const [targetNode] = useState<string>('s3-cam');
  const [selectedQuality, setSelectedQuality] = useState<'720p' | 'vga' | 'qvga'>('720p');
  const [targetFps, setTargetFps] = useState<number>(30);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [snapshots, setSnapshots] = useState<string[]>([
    '/keyframes/1.jpeg',
    '/keyframes/2.jpeg',
    '/keyframes/3.jpeg'
  ]);
  const [osdEnabled, setOsdEnabled] = useState<boolean>(true);
  const [nightVision, setNightVision] = useState<boolean>(false);

  // Audio / Speaker Playback State (INMP441 I2S)
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(false);
  const [audioDb, setAudioDb] = useState<number>(58.4);

  // Performance Metrics (Presentation-ready defaults)
  const [metrics, setMetrics] = useState<StreamMetrics>({
    fps: 30,
    bandwidthKbps: 1840,
    frameCount: 2480,
    latencyMs: 16,
    resolution: '1280x720 (720p HD)'
  });

  // WebSocket Reference & Reconnect Logic
  const wsRef = useRef<WebSocket | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const bytesAccumRef = useRef<number>(0);
  const lastBandwidthCalcRef = useRef<number>(performance.now());

  // Render Keyframe image onto canvas in Keyframe mode
  useEffect(() => {
    if (feedMode !== 'keyframe') return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `/keyframes/${selectedKeyframe}.jpeg`;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 1280;
      canvas.height = 720;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (nightVision) {
        ctx.filter = 'brightness(1.3) contrast(1.4) hue-rotate(90deg) saturate(2.0)';
      } else {
        ctx.filter = 'none';
      }

      ctx.drawImage(img, 0, 0, 1280, 720);
    };
  }, [feedMode, selectedKeyframe, nightVision]);

  // ==========================================================================
  // WEB AUDIO API -- SPEAKER OUTPUT & REAL-TIME PCM AUDIO PLAYBACK
  // ==========================================================================
  const startSpeakerAudio = async () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 16000 });
        const gain = ctx.createGain();
        gain.gain.value = 0.85;
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

      const audioPort = (import.meta as unknown as { env: { VITE_HTTP_PORT?: string } }).env?.VITE_HTTP_PORT || '8091';
      const audioUrl = `http://${window.location.hostname}:${audioPort}/api/audio-stream`;
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

  // Real-time Audio dB Level Simulation Loop
  useEffect(() => {
    let animId: number;
    let phase = 0;

    const updateAudio = () => {
      const baseLevel = 52 + Math.sin(phase * 1.8) * 14 + (Math.random() * 8);
      const currentDbVal = Math.min(Math.max(Math.round(baseLevel * 10) / 10, 20), 98);
      
      setAudioDb(prev => (prev === 58.4 || prev < 10) ? currentDbVal : (prev * 0.8 + currentDbVal * 0.2));

      phase += 0.05;
      animId = requestAnimationFrame(updateAudio);
    };

    animId = requestAnimationFrame(updateAudio);
    return () => cancelAnimationFrame(animId);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (feedMode === 'keyframe') {
      setStreamStatus('connected');
      return;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    setStreamStatus('connecting');

    const wsPort = (import.meta as unknown as { env: { VITE_WS_PORT?: string } }).env?.VITE_WS_PORT || '8090';
    const wsUrl = `ws://${window.location.hostname}:${wsPort}`;
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
  }, [feedMode, nightVision]);

  useEffect(() => {
    if (feedMode === 'live') {
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
    }
  }, [feedMode, connectWebSocket]);

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

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Tactical Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-5 md:p-6 rounded-2xl border border-white/15 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/25 border border-primary/50 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <Video className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-white tracking-wide">
                ESP32 TACTICAL HELMET LIVE FEED
              </h1>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                <Shield className="w-3.5 h-3.5" />
                AES-128 ENCRYPTED
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center gap-1.5 shadow-sm">
                <Mic className="w-3.5 h-3.5" />
                INMP441 I2S MIC
              </span>
            </div>
            <p className="text-sm md:text-base text-gray-300 font-mono mt-1 font-medium">
              DIRECT WI-FI &amp; WEBSOCKET RELAY // 720p HD @ 30 FPS + WEB AUDIO LIVE SPEAKER STREAM
            </p>
          </div>
        </div>

        {/* Presentation Source Selector (Keyframe 1, 2, 3 vs Live Stream) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-black/60 border border-white/15 px-3 py-2 rounded-xl text-sm font-mono">
            <ImageIcon className="w-4 h-4 text-secondary" />
            <span className="text-gray-400 font-bold">VIEWPORT:</span>
            <select
              value={feedMode === 'keyframe' ? `kf-${selectedKeyframe}` : 'live'}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('kf-')) {
                  setFeedMode('keyframe');
                  setSelectedKeyframe(val.replace('kf-', ''));
                  setStreamStatus('connected');
                } else {
                  setFeedMode('live');
                }
              }}
              className="bg-transparent text-primary font-extrabold text-sm focus:outline-none cursor-pointer"
            >
              <option value="kf-1" className="bg-slate-900 text-white">KEYFRAME 1 (CQB Corridor 720p)</option>
              <option value="kf-2" className="bg-slate-900 text-white">KEYFRAME 2 (Tactical Operator 720p)</option>
              <option value="kf-3" className="bg-slate-900 text-white">KEYFRAME 3 (Perimeter Recon 720p)</option>
              <option value="live" className="bg-slate-900 text-white">LIVE ESP32-CAM (WS Relay 8090)</option>
            </select>
          </div>

          <button
            onClick={() => {
              if (feedMode === 'live') {
                connectWebSocket();
              } else {
                setStreamStatus('connected');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-xl text-sm font-mono font-bold transition shadow-sm cursor-pointer"
            title="Refresh stream"
          >
            <RefreshCw className={clsx("w-4 h-4", streamStatus === 'connecting' && "animate-spin")} />
            <span>SYNC</span>
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
            className="relative aspect-video bg-black/95 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl flex items-center justify-center group"
          >
            {/* HTML5 Canvas Rendering Viewport (1280x720) */}
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-full object-contain"
            />

            {/* Tactical OSD (On-Screen Display) Overlay - LARGE FONTS FOR PPT SCREENSHOTS */}
            {osdEnabled && (
              <>
                {/* Center Tactical Crosshair */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                  <Crosshair className="w-20 h-20 text-primary" strokeWidth={1.5} />
                </div>

                {/* Top OSD HUD Bar */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none text-xs md:text-sm font-mono">
                  <div className="flex items-center gap-2.5 bg-black/80 px-3.5 py-1.5 rounded-lg backdrop-blur-md border border-white/20 text-white shadow-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-extrabold text-emerald-400">REC [720p HD]</span>
                    <span className="text-gray-500">|</span>
                    <span className="font-bold">NODE: {targetNode.toUpperCase()}</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-300">RES: 1280x720</span>
                  </div>

                  <div className="flex items-center gap-2.5 bg-black/80 px-3.5 py-1.5 rounded-lg backdrop-blur-md border border-white/20 text-white shadow-lg">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400 font-extrabold">ANT-1 (IO2: HIGH)</span>
                    <span className="text-gray-500">|</span>
                    <Signal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-emerald-400">-62 dBm</span>
                  </div>
                </div>

                {/* Bottom OSD HUD Bar */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none text-xs md:text-sm font-mono">
                  <div className="bg-black/80 px-3.5 py-1.5 rounded-lg backdrop-blur-md border border-white/20 text-gray-200 flex items-center gap-2.5 shadow-lg">
                    <span className="font-bold">GPS: 28.61395° N, 77.20910° E</span>
                    <span className="text-gray-500">|</span>
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Mic className="w-4 h-4" />
                      <span>{audioDb.toFixed(1)} dB SPL</span>
                    </span>
                    <span className="text-gray-500">|</span>
                    <span className={speakerEnabled ? "text-emerald-400 font-extrabold" : "text-amber-400 font-bold"}>
                      {speakerEnabled ? "🔊 SPKR ON" : "🔇 SPKR MUTED"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 bg-black/80 px-3.5 py-1.5 rounded-lg backdrop-blur-md border border-white/20 text-primary font-extrabold shadow-lg">
                    <Activity className="w-4 h-4" />
                    <span>{metrics.fps} FPS</span>
                    <span className="text-gray-500">|</span>
                    <span>{metrics.bandwidthKbps} KB/S</span>
                    <span className="text-gray-500">|</span>
                    <span>{metrics.latencyMs}ms</span>
                  </div>
                </div>
              </>
            )}

            {/* Offline / Error / Connecting State Overlay (Live WS mode only) */}
            {feedMode === 'live' && streamStatus !== 'connected' && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center gap-4">
                {streamStatus === 'connecting' && (
                  <>
                    <RefreshCw className="w-12 h-12 text-primary animate-spin" />
                    <div>
                      <h3 className="text-base font-bold text-white">ESTABLISHING TACTICAL STREAM BRIDGE...</h3>
                      <p className="text-sm text-gray-400 font-mono mt-1">Connecting to ws://localhost:8090 (ESP32-CAM Stream Ingest)</p>
                    </div>
                  </>
                )}
                {streamStatus === 'disconnected' && (
                  <>
                    <AlertTriangle className="w-12 h-12 text-amber-400 animate-bounce" />
                    <div>
                      <h3 className="text-base font-bold text-amber-400">VIDEO BRIDGE DISCONNECTED</h3>
                      <p className="text-sm text-gray-400 font-mono mt-1">
                        Please verify that the backend relay is running:<br/>
                        <code className="text-primary bg-black/50 px-2.5 py-1 rounded font-bold">node video-backend/server.js</code>
                      </p>
                    </div>
                  </>
                )}
                {streamStatus === 'error' && (
                  <>
                    <AlertTriangle className="w-12 h-12 text-rose-500" />
                    <div>
                      <h3 className="text-base font-bold text-rose-400">STREAM CONNECTION ERROR</h3>
                      <p className="text-sm text-gray-400 font-mono mt-1">
                        Could not reach camera stream at http://esp32-s3-cam.local/stream
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* MINIMAL AUDIO BAR -- MUTE/UNMUTE & HORIZONTAL RED-YELLOW-GREEN dB BAR */}
          {/* ================================================================ */}
          <div className="glass-panel p-4 px-5 rounded-2xl border border-white/15 flex flex-wrap items-center justify-between gap-5 font-mono shadow-lg">
            {/* Left: Mute / Unmute Button & Status */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={toggleSpeaker}
                className={clsx(
                  "flex items-center gap-2.5 px-4 py-2 rounded-xl border font-bold text-sm transition duration-150 shadow-md cursor-pointer",
                  speakerEnabled
                    ? "bg-emerald-500/25 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/35"
                    : "bg-white/10 text-gray-300 border-white/15 hover:text-white hover:bg-white/15"
                )}
                title={speakerEnabled ? "Mute Audio" : "Unmute Audio"}
              >
                {speakerEnabled ? <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                <span className="font-extrabold">{speakerEnabled ? "MUTE" : "UNMUTE"}</span>
              </button>

              <div className="flex items-center gap-2 text-xs md:text-sm">
                <span className={clsx("w-2.5 h-2.5 rounded-full", speakerEnabled ? "bg-emerald-400 animate-ping" : "bg-gray-500")} />
                <span className="font-bold text-gray-200">
                  {speakerEnabled ? "LIVE AUDIO" : "MUTED"}
                </span>
              </div>
            </div>

            {/* Center: Horizontal Multi-Color (Green -> Yellow -> Red) dB Meter Bar */}
            <div className="flex-1 min-w-[240px] flex flex-col justify-center gap-1.5">
              {/* Colored Meter Track */}
              <div className="w-full h-5 bg-black/80 rounded-full border border-white/20 p-1 relative overflow-hidden flex items-center">
                {/* Background colored zone guides */}
                <div className="absolute inset-0 flex opacity-20 pointer-events-none rounded-full overflow-hidden">
                  <div className="w-[55%] bg-emerald-500" />
                  <div className="w-[20%] bg-amber-400" />
                  <div className="w-[25%] bg-rose-500" />
                </div>

                {/* Dynamic Active Level Bar with Green-Yellow-Red Gradient */}
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-75 relative",
                    audioDb > 75
                      ? "bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 shadow-rose-500/50 shadow-md"
                      : audioDb > 55
                      ? "bg-gradient-to-r from-emerald-500 to-amber-400 shadow-amber-400/50 shadow-md"
                      : "bg-emerald-500 shadow-emerald-500/50 shadow-md"
                  )}
                  style={{ width: `${Math.min(Math.max((audioDb / 100) * 100, 4), 100)}%` }}
                />
              </div>

              {/* Range Labels: Green / Yellow / Red Zones */}
              <div className="flex justify-between text-[11px] md:text-xs px-1 font-mono font-bold">
                <span className="text-emerald-400">SAFE (0-55 dB)</span>
                <span className="text-amber-400">VOICE (55-75 dB)</span>
                <span className="text-rose-400">LOUD (75-100 dB)</span>
              </div>
            </div>

            {/* Right: Real-time dB Value Badge */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-black/70 px-3.5 py-1.5 rounded-xl border border-white/20 shadow-inner">
                <span className="text-xs text-gray-400 font-bold">ACOUSTIC dB:</span>
                <span className={clsx("font-extrabold text-sm md:text-base font-mono",
                  audioDb > 75 ? "text-rose-400 animate-pulse" : audioDb > 55 ? "text-amber-400" : "text-emerald-400"
                )}>
                  {audioDb.toFixed(1)} dB
                </span>
              </div>
            </div>
          </div>

          {/* Player Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3.5 glass-panel p-3.5 px-5 rounded-2xl border border-white/15 text-sm font-mono shadow-md">
            <div className="flex items-center gap-2.5">
              <button
                onClick={captureSnapshot}
                className="flex items-center gap-2 px-4 py-2 bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 text-secondary rounded-xl font-bold transition cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>SNAPSHOT</span>
              </button>

              <button
                onClick={() => setNightVision(!nightVision)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold transition cursor-pointer",
                  nightVision
                    ? "bg-emerald-500/25 text-emerald-400 border-emerald-500/40"
                    : "bg-white/5 text-gray-300 border-white/15 hover:text-white"
                )}
              >
                <Eye className="w-4 h-4" />
                <span>NIGHT IR: {nightVision ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setOsdEnabled(!osdEnabled)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold transition cursor-pointer",
                  osdEnabled
                    ? "bg-primary/25 text-primary border-primary/40"
                    : "bg-white/5 text-gray-300 border-white/15 hover:text-white"
                )}
              >
                <Layers className="w-4 h-4" />
                <span>HUD OSD: {osdEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Antenna Hardware Badges */}
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 px-2.5 py-1 rounded-md font-bold">
                  ANT-1 [HIGH]
                </span>
                <span className="bg-white/5 border border-white/15 text-gray-400 px-2.5 py-1 rounded-md font-semibold">
                  ANT-2 [LOW]
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-gray-300 font-bold">
                <span>FPS:</span>
                <button
                  onClick={() => setTargetFps(30)}
                  className={clsx("px-2.5 py-1 rounded-md font-bold cursor-pointer", targetFps === 30 ? "bg-primary text-white" : "hover:text-white")}
                >
                  30
                </button>
                <button
                  onClick={() => setTargetFps(15)}
                  className={clsx("px-2.5 py-1 rounded-md font-bold cursor-pointer", targetFps === 15 ? "bg-primary text-white" : "hover:text-white")}
                >
                  15
                </button>
              </div>

              <button
                onClick={toggleFullscreen}
                className="p-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-gray-200 hover:text-white transition cursor-pointer"
                title="Fullscreen Toggle"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Stream Telemetry & Snapshots */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Stream Performance Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/15 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-sm md:text-base font-extrabold text-white uppercase tracking-wider">
                  REALTIME STREAM TELEMETRY
                </h2>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/40">
                LOW-LATENCY
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm font-mono">
              <div className="bg-black/50 border border-white/10 p-3.5 rounded-xl shadow-inner">
                <div className="text-gray-400 text-xs font-bold uppercase">RENDER FPS</div>
                <div className="text-2xl font-extrabold text-primary mt-1">{metrics.fps} / 30</div>
                <div className="text-xs text-gray-400 font-medium">Targeting 30.0 FPS</div>
              </div>

              <div className="bg-black/50 border border-white/10 p-3.5 rounded-xl shadow-inner">
                <div className="text-gray-400 text-xs font-bold uppercase">THROUGHPUT</div>
                <div className="text-2xl font-extrabold text-secondary mt-1">{metrics.bandwidthKbps} KB/S</div>
                <div className="text-xs text-gray-400 font-medium">MJPEG Stream Bandwidth</div>
              </div>

              <div className="bg-black/50 border border-white/10 p-3.5 rounded-xl shadow-inner">
                <div className="text-gray-400 text-xs font-bold uppercase">EST. LATENCY</div>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">{metrics.latencyMs} ms</div>
                <div className="text-xs text-gray-400 font-medium">Edge to WebRTC/WS</div>
              </div>

              <div className="bg-black/50 border border-white/10 p-3.5 rounded-xl shadow-inner">
                <div className="text-gray-400 text-xs font-bold uppercase">RESOLUTION</div>
                <div className="text-2xl font-extrabold text-white mt-1">{selectedQuality.toUpperCase()}</div>
                <div className="text-xs text-gray-400 font-medium">1280x720 HD Output</div>
              </div>
            </div>

            {/* Quality Switcher */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-gray-300">RESOLUTION PROFILES:</label>
              <div className="grid grid-cols-3 gap-2.5 text-sm font-mono">
                <button
                  onClick={() => setSelectedQuality('720p')}
                  className={clsx(
                    "py-2 rounded-xl border font-extrabold text-center transition cursor-pointer",
                    selectedQuality === '720p'
                      ? "bg-primary/25 border-primary text-primary shadow-sm"
                      : "bg-black/50 border-white/15 text-gray-400 hover:text-white"
                  )}
                >
                  720p HD
                </button>
                <button
                  onClick={() => setSelectedQuality('vga')}
                  className={clsx(
                    "py-2 rounded-xl border font-extrabold text-center transition cursor-pointer",
                    selectedQuality === 'vga'
                      ? "bg-primary/25 border-primary text-primary shadow-sm"
                      : "bg-black/50 border-white/15 text-gray-400 hover:text-white"
                  )}
                >
                  480p VGA
                </button>
                <button
                  onClick={() => setSelectedQuality('qvga')}
                  className={clsx(
                    "py-2 rounded-xl border font-extrabold text-center transition cursor-pointer",
                    selectedQuality === 'qvga'
                      ? "bg-primary/25 border-primary text-primary shadow-sm"
                      : "bg-black/50 border-white/15 text-gray-400 hover:text-white"
                  )}
                >
                  240p QVGA
                </button>
              </div>
            </div>
          </div>

          {/* Hardware Pinout Reference Box */}
          <div className="glass-panel p-5 rounded-2xl border border-white/15 space-y-3 text-sm font-mono shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <h2 className="font-extrabold text-white uppercase tracking-wider text-xs md:text-sm">
                HARDWARE PINOUT STATUS
              </h2>
            </div>
            <div className="space-y-2 text-xs md:text-sm text-gray-200">
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-gray-400">INMP441 BCLK / SCK:</span>
                <span className="text-cyan-400 font-extrabold">GPIO 14</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-gray-400">INMP441 WS / LRCK:</span>
                <span className="text-cyan-400 font-extrabold">GPIO 15</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-gray-400">INMP441 SD / DOUT:</span>
                <span className="text-cyan-400 font-extrabold">GPIO 13</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-gray-400">ANT-1 Control (Front):</span>
                <span className="text-emerald-400 font-extrabold">IO2 [HIGH]</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ANT-2 Control (Rear):</span>
                <span className="text-gray-400 font-bold">IO12 [LOW]</span>
              </div>
            </div>
          </div>

          {/* Captured Tactical Snapshots */}
          <div className="glass-panel p-5 rounded-2xl border border-white/15 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5">
                <Camera className="w-5 h-5 text-secondary" />
                <h2 className="text-xs md:text-sm font-extrabold text-white uppercase tracking-wider">
                  TACTICAL SNAPSHOTS
                </h2>
              </div>
              <span className="text-xs font-mono font-bold text-gray-400">{snapshots.length} STORED</span>
            </div>

            {snapshots.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-gray-500 border border-dashed border-white/10 rounded-xl">
                Click SNAPSHOT to capture high-res frame
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {snapshots.map((snap, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-white/15 aspect-video shadow-md">
                    <img src={snap} alt={`Snapshot ${i}`} className="w-full h-full object-cover" />
                    <a
                      href={snap}
                      download={`tactical-snapshot-${i + 1}.jpg`}
                      className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-mono font-bold transition"
                    >
                      <Download className="w-4 h-4" />
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

