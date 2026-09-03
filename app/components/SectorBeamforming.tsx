'use client';

import React, { useState } from 'react';
import { TacticalNode } from '../types/tactical';
import { Radio, ShieldCheck, ChevronDown, ChevronUp, Compass, WifiOff, Zap } from 'lucide-react';

interface SectorBeamformingProps {
  selectedNode: TacticalNode | null;
  allNodes: TacticalNode[];
}

export const SectorBeamforming: React.FC<SectorBeamformingProps> = ({
  selectedNode,
  allNodes,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const node = selectedNode || allNodes.find((n) => !n.isAnchor) || allNodes[0];
  if (!node) return null;

  // Find active ad-hoc peer node
  const peerNode = allNodes.find((n) => n.id === node.nextHopId && !n.isOffline) ||
    allNodes.find((n) => n.isAnchor && n.id !== node.id) ||
    allNodes[0];

  // Compute exact beam vector angle towards ad-hoc peer
  const dx = peerNode ? peerNode.x - node.x : 0;
  const dy = peerNode ? peerNode.y - node.y : 0;
  const peerAngleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  const normalizedAngle = (peerAngleDeg + 360) % 360;

  const isOffline = !!node.isOffline;

  // AS179-92LF Pin 4 / Pin 5 Logic Truth State
  const isAntenna2 = node.activeSector === 4 || node.activeSector === 2;
  const as179V1 = isAntenna2 ? 'LOW' : 'HIGH';
  const as179V2 = isAntenna2 ? 'HIGH' : 'LOW';

  const sectors = [
    { id: 1, name: 'NORTH (0°)', elements: 'P1+P2', angle: '-90deg', label: 'N' },
    { id: 2, name: 'EAST (90°)', elements: 'P2+P3', angle: '0deg', label: 'E' },
    { id: 3, name: 'SOUTH (180°)', elements: 'P3+P4', angle: '90deg', label: 'S' },
    { id: 4, name: 'WEST (270°)', elements: 'P4+P1', angle: '180deg', label: 'W' },
  ];

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-tactical-border dark:border-slate-800 font-mono text-xs select-none shadow-md w-72 transition-colors">
      {/* Header */}
      <div className="border-b border-tactical-border dark:border-slate-800 px-2.5 py-1.5 bg-slate-100/90 dark:bg-slate-800/90 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Radio className={`w-3.5 h-3.5 ${isOffline ? 'text-tactical-crimson animate-pulse' : 'text-tactical-cyan'}`} />
          <span className="font-bold text-[10.5px] text-slate-900 dark:text-white tracking-wider uppercase">
            CONFORMAL ARRAY HUD
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9.5px] px-1.5 py-0.2 font-bold border ${
            isOffline
              ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse'
              : 'bg-sky-50 dark:bg-sky-950/80 border-sky-200 dark:border-sky-800 text-tactical-cyan'
          }`}>
            {node.displayName || node.callsign}
          </span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-2.5 flex flex-col items-center gap-2">
          {/* Conformal Helmet Array Circle */}
          <div className="relative w-28 h-28 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-950/80 overflow-hidden">
            
            {/* SVG Directional Animated Beam Cone OR 360 Radar Sweep */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 112 112">
              {isOffline ? (
                // OFFLINE: 360-DEGREE CONTINUOUS RADAR SEARCH SWEEP
                <g transform="translate(56, 56)">
                  <circle r="46" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                  <g>
                    <path
                      d="M 0 0 L 46 -18 A 48 48 0 0 1 46 18 Z"
                      fill="#ef4444"
                      fillOpacity="0.3"
                      stroke="#ef4444"
                      strokeWidth="1.2"
                    />
                    <line x1="0" y1="0" x2="48" y2="0" stroke="#ef4444" strokeWidth="1.5" />
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0"
                      to="360"
                      dur="2.0s"
                      repeatCount="indefinite"
                    />
                  </g>
                </g>
              ) : (
                // ONLINE: ANIMATED DIRECTED BEAM CONE STEERING TOWARDS AD-HOC PEER
                <g
                  transform={`translate(56, 56) rotate(${peerAngleDeg})`}
                  className="transition-transform duration-500 ease-out"
                >
                  <path
                    d="M 0 0 L 46 -16 A 48 48 0 0 1 46 16 Z"
                    fill="#0284c7"
                    fillOpacity="0.25"
                    stroke="#0284c7"
                    strokeWidth="1.4"
                    strokeDasharray="3 2"
                  />
                  <line x1="0" y1="0" x2="48" y2="0" stroke="#38bdf8" strokeWidth="2" opacity="0.9" />
                </g>
              )}
            </svg>

            {/* AMC Metamaterial Shielding Inner Ring */}
            <div className="relative z-10 w-12 h-12 rounded-full border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center p-0.5 shadow-sm">
              <ShieldCheck className="w-3 h-3 text-tactical-cyan" />
              <span className="text-[6px] text-slate-800 dark:text-slate-200 font-bold leading-none">
                AMC SAR
              </span>
              <span className="text-[5.5px] text-sky-700 dark:text-sky-400 font-semibold leading-none">0.08W/kg</span>
            </div>

            {/* 4 Conformal Patch Sectors */}
            {sectors.map((sec) => {
              const isActive = node.activeSector === sec.id && !isOffline;
              return (
                <div
                  key={sec.id}
                  style={{
                    transform: `rotate(${sec.angle}) translate(40px) rotate(-${sec.angle})`,
                  }}
                  className={`absolute w-5 h-5 flex flex-col items-center justify-center border text-[8px] font-bold transition-all z-10 ${
                    isOffline
                      ? 'bg-red-50 dark:bg-red-950/80 text-red-600 border-red-300 dark:border-red-800 animate-pulse'
                      : isActive
                      ? 'bg-sky-600 text-white border-sky-500 scale-110 shadow-sm ring-1 ring-sky-300'
                      : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {sec.label}
                </div>
              );
            })}
          </div>

          {/* Sector & Ad-Hoc Peer Telemetry Readout */}
          <div className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-2 space-y-1 text-[9px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">BEAM DIRECTION:</span>
              <span className={`font-bold font-mono ${isOffline ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                {isOffline ? '360° SEARCH SWEEP' : `${normalizedAngle}° (${peerAngleDeg >= 0 ? '+' : ''}${peerAngleDeg}°)`}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">STEERED TARGET:</span>
              <strong className="text-sky-700 dark:text-sky-400 font-mono">
                {isOffline ? 'SCANNING BEACON' : peerNode ? peerNode.displayName || peerNode.callsign : 'TOC-ANCHOR'}
              </strong>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700 text-[8.5px]">
              <span className="text-slate-500 dark:text-slate-400">AS179-92LF (D4/D5):</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">
                {isOffline ? 'V1/V2 EVALUATING' : `V1:${as179V1} V2:${as179V2} (ANT ${isAntenna2 ? 2 : 1})`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

