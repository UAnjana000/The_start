'use client';

import React, { useState } from 'react';
import { GitFork, Radio, Shield, Activity, Cpu, Play, Pause, RefreshCw } from 'lucide-react';

export const DataFlowDiagram: React.FC = () => {
  const [animating, setAnimating] = useState(true);

  return (
    <div className="bg-white border border-tactical-border font-mono text-xs select-none p-3 shadow-none">
      {/* Header */}
      <div className="border-b border-slate-200 pb-2 mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-tactical-cyan" />
          <span className="font-bold tracking-wider text-slate-900 text-[11.5px]">
            SYSTEM ARCHITECTURE &amp; DATA FLOW UML (ANIMATED PIPELINE)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnimating(!animating)}
            className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold flex items-center gap-1"
          >
            {animating ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
            {animating ? 'PAUSE FLOW' : 'RESUME FLOW'}
          </button>
          <span className="text-[10px] bg-slate-100 border border-slate-300 text-slate-700 px-2 py-0.5 font-bold">
            SIH PS 26185
          </span>
        </div>
      </div>

      {/* Interactive Animated SVG UML Diagram */}
      <div className="relative w-full bg-slate-50 border border-slate-200 p-2 overflow-x-auto">
        <svg viewBox="0 0 1000 240" className="w-full min-w-[760px] h-auto font-mono">
          <defs>
            {/* Markers for UML connectors */}
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
            </marker>
            <marker id="arrow-crimson" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
            </marker>
            <marker id="arrow-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#16a34a" />
            </marker>
          </defs>

          {/* Connectors (UML Association Lines) */}
          {/* Connector 1: Helmet -> Mesh Anchor */}
          <line x1="220" y1="90" x2="280" y2="90" stroke="#0284c7" strokeWidth="2" strokeDasharray={animating ? "4 3" : "none"} markerEnd="url(#arrow)" />
          {/* Connector 2: Mesh Anchor -> Math Engine */}
          <line x1="480" y1="90" x2="540" y2="90" stroke="#0284c7" strokeWidth="2" strokeDasharray={animating ? "4 3" : "none"} markerEnd="url(#arrow)" />
          {/* Connector 3: Math Engine -> C2 Dashboard */}
          <line x1="740" y1="90" x2="800" y2="90" stroke="#0284c7" strokeWidth="2" strokeDasharray={animating ? "4 3" : "none"} markerEnd="url(#arrow)" />

          {/* Feedback Healing Loop: C2 Dashboard / Math Engine -> Helmet Node */}
          <path d="M 640 180 L 640 210 L 120 210 L 120 180" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray={animating ? "5 4" : "none"} markerEnd="url(#arrow-crimson)" />

          {/* Animated Data Packets Flowing */}
          {animating && (
            <>
              {/* Packet 1: Telemetry Updates (Left to Right) */}
              <circle r="4" fill="#0284c7">
                <animateMotion path="M 220 90 L 280 90" dur="1.2s" repeatCount="indefinite" />
              </circle>
              {/* Packet 2: State JSON (Anchor to Math) */}
              <circle r="4" fill="#0284c7">
                <animateMotion path="M 480 90 L 540 90" dur="1.2s" repeatCount="indefinite" />
              </circle>
              {/* Packet 3: Topology & Ghost Vector (Math to C2) */}
              <circle r="4" fill="#16a34a">
                <animateMotion path="M 740 90 L 800 90" dur="1.2s" repeatCount="indefinite" />
              </circle>
              {/* Packet 4: Tactical Voice Reposition Vector (Feedback Loop) */}
              <circle r="4" fill="#dc2626">
                <animateMotion path="M 640 180 L 640 210 L 120 210 L 120 180" dur="2.4s" repeatCount="indefinite" />
              </circle>
            </>
          )}

          {/* UML Component 1: Commando Helmet Hardware */}
          <g transform="translate(20, 20)">
            <rect width="200" height="160" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" rx="2" />
            <rect width="200" height="28" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <text x="10" y="18" fill="#0f172a" fontSize="11" fontWeight="bold">«ConformalArray»</text>
            <text x="10" y="44" fill="#0284c7" fontSize="10" fontWeight="bold">ESP32 Commando Node</text>
            
            <line x1="0" y1="52" x2="200" y2="52" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="68" fill="#475569" fontSize="9">+ rssi_dbm: float</text>
            <text x="10" y="82" fill="#475569" fontSize="9">+ noise_floor_N: float</text>
            <text x="10" y="96" fill="#475569" fontSize="9">+ active_sector: int [1..4]</text>
            <text x="10" y="110" fill="#475569" fontSize="9">+ amc_shield_sar: 0.08 W/kg</text>

            <line x1="0" y1="118" x2="200" y2="118" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="132" fill="#0f172a" fontSize="9">+ evalSINR()</text>
            <text x="10" y="146" fill="#0f172a" fontSize="9">+ switchSector(pin_diodes)</text>
          </g>

          {/* UML Component 2: MANET Mesh & Anchor Ingress */}
          <g transform="translate(280, 20)">
            <rect width="200" height="160" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" rx="2" />
            <rect width="200" height="28" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <text x="10" y="18" fill="#0f172a" fontSize="11" fontWeight="bold">«MANETRouting»</text>
            <text x="10" y="44" fill="#0284c7" fontSize="10" fontWeight="bold">TOC Anchor (0,0)</text>
            
            <line x1="0" y1="52" x2="200" y2="52" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="68" fill="#475569" fontSize="9">+ datum_coords: (0.0, 0.0)</text>
            <text x="10" y="82" fill="#475569" fontSize="9">+ mesh_protocol: B.A.T.M.A.N.</text>
            <text x="10" y="96" fill="#475569" fontSize="9">+ ws_gateway: /api/ws</text>
            <text x="10" y="110" fill="#475569" fontSize="9">+ encryption: AES-256 GCM</text>

            <line x1="0" y1="118" x2="200" y2="118" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="132" fill="#0f172a" fontSize="9">+ routePackets()</text>
            <text x="10" y="146" fill="#0f172a" fontSize="9">+ forwardTelemetry(500ms)</text>
          </g>

          {/* UML Component 3: Spatial Math & Ghost Healing Engine */}
          <g transform="translate(540, 20)">
            <rect width="200" height="160" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" rx="2" />
            <rect width="200" height="28" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <text x="10" y="18" fill="#0f172a" fontSize="11" fontWeight="bold">«SpatialEngine»</text>
            <text x="10" y="44" fill="#d97706" fontSize="10" fontWeight="bold">RF Math &amp; Healing Core</text>
            
            <line x1="0" y1="52" x2="200" y2="52" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="68" fill="#475569" fontSize="9">+ fspl_1420mhz: Friis loss</text>
            <text x="10" y="82" fill="#475569" fontSize="9">+ wall_loss: -28.0 dB</text>
            <text x="10" y="96" fill="#475569" fontSize="9">+ jammer_noise_N: [0..40dB]</text>
            <text x="10" y="110" fill="#475569" fontSize="9">+ min_video_sinr: 14.0 dB</text>

            <line x1="0" y1="118" x2="200" y2="118" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="132" fill="#0f172a" fontSize="9">+ computeSINR(S, I, N)</text>
            <text x="10" y="146" fill="#dc2626" fontSize="9" fontWeight="bold">+ solveGhostWaypoint()</text>
          </g>

          {/* UML Component 4: Mission Commander C2 Console */}
          <g transform="translate(800, 20)">
            <rect width="180" height="160" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" rx="2" />
            <rect width="180" height="28" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <text x="10" y="18" fill="#0f172a" fontSize="11" fontWeight="bold">«C2Console»</text>
            <text x="10" y="44" fill="#0284c7" fontSize="10" fontWeight="bold">Palantir Web Dashboard</text>
            
            <line x1="0" y1="52" x2="180" y2="52" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="68" fill="#475569" fontSize="9">+ 2d_canvas: 60 FPS</text>
            <text x="10" y="82" fill="#475569" fontSize="9">+ lband_video_pip: HUD</text>
            <text x="10" y="96" fill="#475569" fontSize="9">+ blackbox_db: IndexedDB</text>
            <text x="10" y="110" fill="#475569" fontSize="9">+ deployment: Vercel Native</text>

            <line x1="0" y1="118" x2="180" y2="118" stroke="#e2e8f0" strokeWidth="1" />
            <text x="10" y="132" fill="#0f172a" fontSize="9">+ renderGhostVector()</text>
            <text x="10" y="146" fill="#0f172a" fontSize="9">+ issueVoiceRelayCmd()</text>
          </g>

          {/* Feedback Label */}
          <rect x="260" y="198" width="360" height="24" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" rx="2" />
          <text x="270" y="214" fill="#b91c1c" fontSize="9.5" fontWeight="bold">
            ◄ AD-HOC HEALING: COMMANDER RADIO VECTOR ("BRAVO, FALLBACK 7.2m WNW")
          </text>
        </svg>
      </div>
    </div>
  );
};
