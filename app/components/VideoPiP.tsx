'use client';

import React, { useState, useEffect } from 'react';
import { TacticalNode, NodeLink, OperationalMode } from '../types/tactical';
import { Video, Maximize2, Minimize2, AlertTriangle, Radio } from 'lucide-react';

interface VideoPiPProps {
  nodes: TacticalNode[];
  links: NodeLink[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  mode: OperationalMode;
}

// Tactical combat looping animated feeds for demo mode ONLY
const COMBAT_FEEDS: Record<string, { title: string; gifUrl: string }> = {
  'CMD-01': {
    title: 'ALPHA POINTMAN // ROOM ENTRY CQB',
    gifUrl: 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?auto=format&fit=crop&w=600&q=80',
  },
  'CMD-02': {
    title: 'BRAVO ASSAULT // HOSTILE CORRIDOR ADVANCE',
    gifUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=600&q=80',
  },
  'CMD-03': {
    title: 'CHARLIE BREACHER // PERIMETER SECURE',
    gifUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=600&q=80',
  },
  'CMD-04': {
    title: 'DELTA MARKSMAN // HIGH GROUND OVERWATCH',
    gifUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=600&q=80',
  },
  'CMD-05': {
    title: 'ECHO SCOUT // DEEP PENETRATION RECON',
    gifUrl: 'https://images.unsplash.com/photo-1533518463841-d62e1fc91373?auto=format&fit=crop&w=600&q=80',
  },
};

export const VideoPiP: React.FC<VideoPiPProps> = ({
  nodes,
  links,
  selectedNodeId,
  onSelectNode,
  mode,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [nvgMode, setNvgMode] = useState(true);
  const [position, setPosition] = useState({ x: 24, y: 76 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [frameTick, setFrameTick] = useState(0);

  const isLive = mode === 'live';
  const activeOperators = nodes.filter((n) => !n.isAnchor);
  const currentNode = nodes.find((n) => n.id === selectedNodeId) || activeOperators[0] || nodes[0];
  const currentLink = links.find((l) => l.fromId === currentNode?.id);

  const sinr = currentLink ? currentLink.sinrDb : 24.5;
  const isVideoOnline = sinr >= 12.0;

  // Frame tick simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setFrameTick((prev) => (prev + 1) % 1000);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(10, Math.min(window.innerWidth - 340, e.clientX - dragOffset.x)),
          y: Math.max(50, Math.min(window.innerHeight - 240, e.clientY - dragOffset.y)),
        });
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!currentNode) return null;
  const feedMeta = COMBAT_FEEDS[currentNode.id] || COMBAT_FEEDS['CMD-01'];

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 50,
      }}
      className={`bg-white border-2 border-slate-900 font-mono text-xs shadow-xl select-none w-80 ${
        isDragging ? 'opacity-90' : ''
      }`}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="px-3 py-1.5 bg-slate-900 text-white flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <Video className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-bold text-[11px] text-white tracking-wider">
            {isLive ? `LIVE HW FEED: ${currentNode.callsign}` : `L-BAND COMBAT FEED: ${currentNode.callsign}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isLive && (
            <button
              onClick={() => setNvgMode(!nvgMode)}
              className={`p-1 text-[9px] border px-1.5 font-bold ${
                nvgMode
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              NVG / IR
            </button>
          )}
          <button
            onClick={() => setMinimized(!minimized)}
            className="text-slate-400 hover:text-white"
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Video Content Viewport */}
      {!minimized && (
        <div className="w-full h-48 relative bg-black overflow-hidden flex flex-col justify-between p-2">
          {/* Scanline CRT overlay */}
          <div className="absolute inset-0 tactical-scanlines pointer-events-none opacity-30 z-10" />

          {/* LIVE MODE: Real Hardware Carrier View (Zero Fake GIFs) */}
          {isLive ? (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-3 text-center z-10">
              <Radio className="w-8 h-8 text-sky-400 mb-2 animate-pulse" />
              <div className="text-white font-bold text-[11px] tracking-wider">
                L-BAND HW CARRIER (1420.0 MHz)
              </div>
              <div className="text-slate-400 text-[9.5px] mt-1 space-y-0.5">
                <div>NODE: <span className="text-sky-300 font-bold">{currentNode.id} ({currentNode.callsign})</span></div>
                <div>RF CARRIER: <span className="text-emerald-400 font-bold">ONLINE ({sinr.toFixed(1)} dB SINR)</span></div>
                <div className="text-amber-400 text-[8.5px] mt-1.5 border border-amber-800/60 bg-amber-950/40 px-2 py-0.5">
                  AWAITING HARDWARE RTSP / WEBRTC CAMERA STREAM
                </div>
              </div>
            </div>
          ) : isVideoOnline ? (
            /* SIMULATION / DEMO MODE: Combat Footage Simulation */
            <div className="absolute inset-0 overflow-hidden">
              <div
                style={{
                  backgroundImage: `url(${feedMeta.gifUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: nvgMode
                    ? 'contrast(1.4) brightness(0.9) hue-rotate(90deg) saturate(2)'
                    : 'contrast(1.2) brightness(0.8)',
                }}
                className="absolute inset-0 w-full h-full transform scale-105"
              />

              {nvgMode && (
                <div className="absolute inset-0 bg-emerald-950/40 mix-blend-multiply pointer-events-none" />
              )}

              {/* Tactical HUD Reticle & Crosshair Layer */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  style={{
                    transform: `translate(${(Math.sin(frameTick * 0.1) * 8).toFixed(1)}px, ${(
                      Math.cos(frameTick * 0.12) * 5
                    ).toFixed(1)}px)`,
                  }}
                  className="relative flex items-center justify-center"
                >
                  <div className="w-14 h-14 border border-emerald-400/60 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                  </div>
                  <div className="absolute w-24 h-0.5 bg-emerald-400/40" />
                  <div className="absolute h-24 w-0.5 bg-emerald-400/40" />
                  <div className="absolute -top-6 -left-6 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute -top-6 -right-6 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute -bottom-6 -left-6 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute -bottom-6 -right-6 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
                </div>
              </div>

              {/* Top HUD Overlays */}
              <div className="absolute top-2 left-2 text-[9px] text-emerald-300 font-mono font-bold z-20 bg-black/60 px-1.5 py-0.5 border border-emerald-900/60">
                <div>CAM-0{currentNode.activeSector} // CQB HELMET CAM</div>
                <div>AZ: {(135 + (frameTick % 25)).toFixed(0)}° // ELEV: +02°</div>
              </div>

              <div className="absolute top-2 right-2 text-[9px] text-emerald-400 font-mono flex items-center gap-1 font-bold z-20 bg-black/60 px-1.5 py-0.5 border border-emerald-900/60">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                <span>LIVE 1080p60</span>
              </div>

              {/* Bottom HUD Telemetry */}
              <div className="absolute bottom-9 left-2 text-[8.5px] text-slate-200 font-mono z-20 bg-black/70 px-1.5 py-0.5">
                REL POS: ({currentNode.x.toFixed(1)}m, {currentNode.y.toFixed(1)}m) | {currentNode.hopCount ?? 1} HOP(S)
              </div>
            </div>
          ) : (
            /* Simulation Jammed Screen */
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-3 text-center z-20">
              <AlertTriangle className="w-7 h-7 text-tactical-crimson mb-1.5 animate-bounce" />
              <div className="text-tactical-crimson font-bold text-[11px]">
                L-BAND CARRIER LOST (JAMMED)
              </div>
              <div className="text-slate-400 text-[9px] mt-1 leading-tight">
                SINR ({sinr.toFixed(1)} dB) &lt; 12 dB threshold.
                <br />
                <span className="text-amber-400 font-semibold">
                  Reposition toward projected Ghost Relay waypoint.
                </span>
              </div>
            </div>
          )}

          {/* Bottom Operator Quick Selector */}
          <div className="z-30 flex items-center justify-between bg-black/90 border border-slate-700 px-2 py-1 text-[9px] mt-auto">
            <span className="text-slate-400">OPERATOR:</span>
            <div className="flex gap-1">
              {activeOperators.map((op) => (
                <button
                  key={op.id}
                  onClick={() => onSelectNode(op.id)}
                  className={`px-1.5 py-0.2 border text-[8px] font-bold ${
                    currentNode.id === op.id
                      ? 'bg-sky-400 text-slate-950 border-sky-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  {op.id.replace('CMD-', 'C')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
