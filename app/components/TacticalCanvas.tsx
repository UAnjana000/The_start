'use client';

import React, { useRef, useState, useCallback } from 'react';
import { TacticalNode, NodeLink, ObstacleWall, GhostNode, OperationalMode, JammerState } from '../types/tactical';
import { Crosshair, Shield, RotateCcw, AlertTriangle, Move, Focus, Play, Pause, FileJson } from 'lucide-react';
import { SectorBeamforming } from './SectorBeamforming';
import { JammerControl } from './JammerControl';

interface TacticalCanvasProps {
  nodes: TacticalNode[];
  links: NodeLink[];
  walls: ObstacleWall[];
  ghostNodes: GhostNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onToggleWall: (id: string) => void;
  onResetLayout: () => void;
  mode: OperationalMode;
  jammer: JammerState;
  onUpdateJammer: (jammer: JammerState) => void;
  isPlayingSim?: boolean;
  onTogglePlaySim?: () => void;
  simTime?: number;
  simPhaseName?: string;
  onSeekSimTime?: (time: number) => void;
  onOpenEditor?: () => void;
}

export function getLinkRssiStyle(rssiDbm: number = -70, isBlocked: boolean = false, isOffline: boolean = false) {
  if (isOffline || isBlocked || rssiDbm <= -88) {
    return {
      strokeColor: '#ef4444', // Red
      strokeDash: '5 4',
      strokeWidth: 2,
      badgeText: isBlocked ? `BLOCKED (${rssiDbm.toFixed(0)} dBm)` : `${rssiDbm.toFixed(0)} dBm`,
      badgeBg: '#450a0a',
      badgeBorder: '#ef4444',
      badgeTextFill: '#fca5a5',
      glowColor: 'rgba(239, 68, 68, 0.4)',
    };
  }
  if (rssiDbm >= -60) {
    return {
      strokeColor: '#10b981', // Emerald Green (Strong)
      strokeDash: 'none',
      strokeWidth: 3,
      badgeText: `${rssiDbm.toFixed(0)} dBm (STRONG)`,
      badgeBg: '#064e3b',
      badgeBorder: '#10b981',
      badgeTextFill: '#6ee7b7',
      glowColor: 'rgba(16, 185, 129, 0.4)',
    };
  }
  if (rssiDbm >= -72) {
    return {
      strokeColor: '#06b6d4', // Cyan (Good)
      strokeDash: 'none',
      strokeWidth: 2.5,
      badgeText: `${rssiDbm.toFixed(0)} dBm (GOOD)`,
      badgeBg: '#083344',
      badgeBorder: '#06b6d4',
      badgeTextFill: '#67e8f9',
      glowColor: 'rgba(6, 182, 212, 0.4)',
    };
  }
  if (rssiDbm >= -82) {
    return {
      strokeColor: '#f59e0b', // Amber (Fair)
      strokeDash: '6 3',
      strokeWidth: 2,
      badgeText: `${rssiDbm.toFixed(0)} dBm (FAIR)`,
      badgeBg: '#451a03',
      badgeBorder: '#f59e0b',
      badgeTextFill: '#fcd34d',
      glowColor: 'rgba(245, 158, 11, 0.4)',
    };
  }
  return {
    strokeColor: '#f97316', // Orange (Poor)
    strokeDash: '5 3',
    strokeWidth: 2,
    badgeText: `${rssiDbm.toFixed(0)} dBm (POOR)`,
    badgeBg: '#431407',
    badgeBorder: '#f97316',
    badgeTextFill: '#fdba74',
    glowColor: 'rgba(249, 115, 22, 0.4)',
  };
}

export const TacticalCanvas: React.FC<TacticalCanvasProps> = ({
  nodes,
  links,
  walls,
  ghostNodes,
  selectedNodeId,
  onSelectNode,
  onUpdateNodePosition,
  onToggleWall,
  onResetLayout,
  mode,
  jammer,
  onUpdateJammer,
  isPlayingSim = false,
  onTogglePlaySim,
  simTime = 0.0,
  simPhaseName,
  onSeekSimTime,
  onOpenEditor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(22);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [showRings, setShowRings] = useState<boolean>(true);
  const [showSectors, setShowSectors] = useState<boolean>(true);

  // Center coordinate mapping incorporating pan offset
  const getScreenCoords = useCallback((x: number, y: number, width: number, height: number) => {
    return {
      cx: width / 2 + panOffset.x + x * zoom,
      cy: height / 2 + panOffset.y - y * zoom,
    };
  }, [zoom, panOffset]);

  const getMeterCoords = useCallback((cx: number, cy: number, width: number, height: number) => {
    return {
      x: parseFloat(((cx - (width / 2 + panOffset.x)) / zoom).toFixed(1)),
      y: parseFloat((((height / 2 + panOffset.y) - cy) / zoom).toFixed(1)),
    };
  }, [zoom, panOffset]);

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string, isAnchor?: boolean) => {
    e.stopPropagation();
    if (mode === 'live' || isAnchor) return;
    if (isPlayingSim && onTogglePlaySim) {
      onTogglePlaySim();
    }
    setDraggingNodeId(nodeId);
    onSelectNode(nodeId);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Left click or middle click on canvas background triggers panning
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingNodeId && containerRef.current && mode === 'simulation') {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { x, y } = getMeterCoords(cx, cy, rect.width, rect.height);
      onUpdateNodePosition(draggingNodeId, x, y);
    } else if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
  };

  const handleResetPan = () => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(20);
  };

  const isLive = mode === 'live';
  const displayWalls = isLive ? [] : walls;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[1] || nodes[0];

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative w-full ${
        isLive ? 'h-[calc(100vh-118px)]' : 'h-[calc(100vh-68px)]'
      } min-h-[580px] bg-[#f8fafc] dark:bg-slate-950 border border-tactical-border overflow-hidden select-none font-mono shadow-none ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Tactical Light & Dark Grid Background */}
      <div
        style={{
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
        }}
        className="absolute inset-0 tactical-grid opacity-80 pointer-events-none"
      />
      <div
        style={{
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
        }}
        className="absolute inset-0 tactical-subgrid opacity-60 pointer-events-none"
      />

      {/* Top Left HUD Overlay */}
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-1.5 pointer-events-auto">
        <div className="bg-white/95 dark:bg-slate-900/95 border border-tactical-border px-3 py-1.5 text-xs flex items-center gap-2 shadow-sm">
          <Crosshair className="w-3.5 h-3.5 text-tactical-cyan" />
          <span className="text-tactical-textMuted">MAP DATUM:</span>
          <span className="text-tactical-textBright font-bold">REL-GRID TANK-00 (0,0)</span>
          <span className="text-[10px] text-tactical-cyan ml-2 bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 px-1.5 font-semibold">
            PAN: ({Math.round(panOffset.x)}px, {Math.round(panOffset.y)}px)
          </span>
        </div>

        {/* Tactical Toolbar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowRings(!showRings)}
            className={`px-2 py-1 text-[11px] border font-semibold ${
              showRings
                ? 'bg-white dark:bg-slate-900 text-tactical-textBright border-tactical-border'
                : 'bg-tactical-panel dark:bg-slate-800 text-tactical-textMuted border-tactical-borderLight'
            }`}
          >
            RANGE RINGS
          </button>
          <button
            onClick={() => setShowSectors(!showSectors)}
            className={`px-2 py-1 text-[11px] border font-semibold ${
              showSectors
                ? 'bg-white dark:bg-slate-900 text-tactical-textBright border-tactical-border'
                : 'bg-tactical-panel dark:bg-slate-800 text-tactical-textMuted border-tactical-borderLight'
            }`}
          >
            ADHOC BEAMS
          </button>
          <button
            onClick={handleResetPan}
            title="Reset Pan & Center"
            className="px-2 py-1 text-[11px] bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-tactical-border text-slate-800 dark:text-slate-200 flex items-center gap-1 font-semibold"
          >
            <Focus className="w-3 h-3 text-tactical-cyan" />
            RE-CENTER
          </button>

          {/* Integrated Zoom Controls */}
          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-tactical-border px-1 py-0.5">
            <button
              onClick={() => setZoom((prev) => Math.max(10, prev - 2))}
              className="px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold"
              title="Zoom Out"
            >
              -
            </button>
            <span className="text-[10px] text-slate-900 dark:text-white px-1 font-bold">{zoom}x</span>
            <button
              onClick={() => setZoom((prev) => Math.min(36, prev + 2))}
              className="px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {!isLive && (
            <button
              onClick={onResetLayout}
              className="px-2 py-1 text-[11px] bg-tactical-panel dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-tactical-border text-tactical-textLight flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              RESET
            </button>
          )}
        </div>
      </div>

      {/* Upper Right: EW Jammer Panel (Collapsed by default in Demo Mode) */}
      {!isLive && (
        <div className="absolute top-3 right-3 z-30 pointer-events-auto">
          <JammerControl jammer={jammer} onUpdateJammer={onUpdateJammer} mode={mode} />
        </div>
      )}

      {/* Lower Right: Conformal Patch Array Beamforming (Collapsed by default) */}
      <div className="absolute bottom-12 right-3 z-30 pointer-events-auto">
        <SectorBeamforming selectedNode={selectedNode} allNodes={nodes} />
      </div>

      {/* SVG Canvas Rendering Nodes, Links, Walls, and Ghost Vectors */}
      {containerRef.current && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {(() => {
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            const center = getScreenCoords(0, 0, width, height);

            return (
              <g>
                {/* Distance Range Concentric Rings centered on Tank (0,0) */}
                {showRings &&
                  [5, 10, 15, 20, 25, 30].map((radiusMeters) => (
                    <g key={`ring-${radiusMeters}`}>
                      <circle
                        cx={center.cx}
                        cy={center.cy}
                        r={radiusMeters * zoom}
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={center.cx + radiusMeters * zoom + 4}
                        y={center.cy - 4}
                        fill="#94a3b8"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {radiusMeters}m
                      </text>
                    </g>
                  ))}

                {/* Coordinate Crosshairs centered at Tank (0,0) */}
                <line
                  x1={0}
                  y1={center.cy}
                  x2={width}
                  y2={center.cy}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />
                <line
                  x1={center.cx}
                  y1={0}
                  x2={center.cx}
                  y2={height}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />

                {/* Tactical Building Floorplan Blueprint (Dark CQB CQB Interior) */}
                <g opacity="0.85">
                  {/* ROOM 101 - STAGING / TOC ENTRY */}
                  <rect
                    x={getScreenCoords(-6, -4, width, height).cx}
                    y={getScreenCoords(-6, 6, width, height).cy}
                    width={13 * zoom}
                    height={10 * zoom}
                    fill="#0f172a"
                    fillOpacity="0.4"
                    stroke="#1e293b"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />
                  <text
                    x={getScreenCoords(-5.5, 5.2, width, height).cx}
                    y={getScreenCoords(-5.5, 5.2, width, height).cy}
                    fill="#475569"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    ZONE ALPHA // TOC STAGING AREA
                  </text>

                  {/* CQB CORRIDOR 01 */}
                  <rect
                    x={getScreenCoords(1, 0, width, height).cx}
                    y={getScreenCoords(1, 5.5, width, height).cy}
                    width={7 * zoom}
                    height={5.5 * zoom}
                    fill="#0284c7"
                    fillOpacity="0.04"
                    stroke="#0369a1"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={getScreenCoords(1.5, 4.8, width, height).cx}
                    y={getScreenCoords(1.5, 4.8, width, height).cy}
                    fill="#0284c7"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    opacity="0.7"
                  >
                    CORRIDOR 01 (NSG INGRESS ROUTE)
                  </text>

                  {/* OBJECTIVE ROOM BRAVO (TARGET AREA BEHIND CONCRETE WALL) */}
                  <rect
                    x={getScreenCoords(8, 0, width, height).cx}
                    y={getScreenCoords(8, 11, width, height).cy}
                    width={11 * zoom}
                    height={11 * zoom}
                    fill="#1e1b4b"
                    fillOpacity="0.35"
                    stroke="#312e81"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />
                  <text
                    x={getScreenCoords(8.5, 10.2, width, height).cx}
                    y={getScreenCoords(8.5, 10.2, width, height).cy}
                    fill="#818cf8"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    OBJECTIVE SECTOR BRAVO // ASSAULT TARGET
                  </text>
                </g>

                {/* Render Obstacle Concrete Barriers */}
                {displayWalls.map((wall) => {
                  const p1 = getScreenCoords(wall.x1, wall.y1, width, height);
                  const p2 = getScreenCoords(wall.x2, wall.y2, width, height);
                  const midX = (p1.cx + p2.cx) / 2;
                  const midY = (p1.cy + p2.cy) / 2;
                  return (
                    <g
                      key={wall.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => onToggleWall(wall.id)}
                    >
                      {/* Clean Concrete Barrier Core */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#7f1d1d"
                        strokeWidth="10"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      {/* Warning Stripe Center */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      {/* Compact Wall Badge */}
                      <g transform={`translate(${midX}, ${midY - 14})`}>
                        <rect
                          x="-68"
                          y="-9"
                          width="136"
                          height="18"
                          fill="#0f172a"
                          stroke="#ef4444"
                          strokeWidth="1"
                          rx="3"
                        />
                        <text
                          x="0"
                          y="4"
                          fill="#fca5a5"
                          fontSize="9"
                          textAnchor="middle"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          CONCRETE WALL (-{wall.attenuationDb}dB)
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Render Active Ad-Hoc Multi-Hop Mesh Links Styled Directly by RSSI */}
                {links.map((link) => {
                  const fromNode = nodes.find((n) => n.id === link.fromId);
                  const toNode = nodes.find((n) => n.id === link.toId);
                  if (!fromNode || !toNode) return null;

                  const fromX = fromNode.isOffline ? (fromNode.lastOnlineX ?? fromNode.x) : fromNode.x;
                  const fromY = fromNode.isOffline ? (fromNode.lastOnlineY ?? fromNode.y) : fromNode.y;
                  const toX = toNode.isOffline ? (toNode.lastOnlineX ?? toNode.x) : toNode.x;
                  const toY = toNode.isOffline ? (toNode.lastOnlineY ?? toNode.y) : toNode.y;

                  const p1 = getScreenCoords(fromX, fromY, width, height);
                  const p2 = getScreenCoords(toX, toY, width, height);

                  const isOfflineLink = !!(fromNode.isOffline || toNode.isOffline || link.status === 'broken');
                  const isBlocked = !!(link.isBlockedByWall || isOfflineLink);
                  const style = getLinkRssiStyle(link.rssiDbm, isBlocked, isOfflineLink);

                  const midX = (p1.cx + p2.cx) / 2;
                  const midY = (p1.cy + p2.cy) / 2;

                  return (
                    <g key={`${link.fromId}-${link.toId}`}>
                      {/* Outer soft glow halo */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke={style.strokeColor}
                        strokeWidth={style.strokeWidth + 4}
                        strokeOpacity="0.18"
                      />
                      {/* Main RSSI-Colored Link Line */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke={style.strokeColor}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.strokeDash}
                        strokeOpacity={isBlocked ? 0.75 : 0.95}
                      />
                      {/* Dynamic flow pulse particle along connected line */}
                      {!isBlocked && (
                        <circle
                          cx={p1.cx * 0.45 + p2.cx * 0.55}
                          cy={p1.cy * 0.45 + p2.cy * 0.55}
                          r="3.5"
                          fill={style.strokeColor}
                          className="animate-pulse"
                        />
                      )}

                      {/* Prominent RSSI Value Badge on the Link Line */}
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x="-46"
                          y="-10"
                          width="92"
                          height="20"
                          fill={style.badgeBg}
                          stroke={style.badgeBorder}
                          strokeWidth="1.2"
                          rx="3"
                        />
                        <text
                          x="0"
                          y="4"
                          fill={style.badgeTextFill}
                          fontSize="9"
                          textAnchor="middle"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {style.badgeText}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Render Ghost Nodes (Pulsing Green Relay Node at Corner) */}
                {ghostNodes.map((ghost) => {
                  const opt = getScreenCoords(ghost.optimalX, ghost.optimalY, width, height);

                  return (
                    <g key={`ghost-${ghost.targetNodeId}`} transform={`translate(${opt.cx}, ${opt.cy})`}>
                      <circle r="26" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                      <circle r="18" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.7" className="animate-ping" />
                      <circle r="10" fill="#10b981" fillOpacity="0.3" stroke="#10b981" strokeWidth="2" />
                      <circle r="3.5" fill="#ffffff" />

                      {/* Compact Relay Badge */}
                      <g transform="translate(0, -18)">
                        <rect
                          x="-48"
                          y="-8"
                          width="96"
                          height="16"
                          fill="#064e3b"
                          stroke="#10b981"
                          strokeWidth="1.2"
                          rx="2"
                        />
                        <text
                          x="0"
                          y="4"
                          fill="#a7f3d0"
                          fontSize="8.5"
                          textAnchor="middle"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          ✦ RELAY DEPLOYED
                        </text>
                      </g>
                    </g>
                  );
                })}


                {/* Conformal Beam Sector Cones & 360-Degree Sweep on Disconnected Nodes */}
                {showSectors &&
                  nodes.map((node) => {
                    if (node.isAnchor) return null;
                    const posX = node.isOffline ? (node.lastOnlineX ?? node.x) : node.x;
                    const posY = node.isOffline ? (node.lastOnlineY ?? node.y) : node.y;
                    const p = getScreenCoords(posX, posY, width, height);

                    if (node.isOffline) {
                      return (
                        <g key={`beam-sweep-${node.id}`} transform={`translate(${p.cx}, ${p.cy})`}>
                          <circle r="48" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
                          <circle r="28" fill="none" stroke="#ef4444" strokeWidth="0.8" opacity="0.35" />
                          <g>
                            <path
                              d="M 0 0 L 48 -20 A 52 52 0 0 1 48 20 Z"
                              fill="#ef4444"
                              fillOpacity="0.25"
                              stroke="#ef4444"
                              strokeWidth="1.4"
                            />
                            <line x1="0" y1="0" x2="50" y2="0" stroke="#ef4444" strokeWidth="1.8" opacity="0.8" />
                            <animateTransform
                              attributeName="transform"
                              type="rotate"
                              from="0"
                              to="360"
                              dur="2.4s"
                              repeatCount="indefinite"
                            />
                          </g>
                        </g>
                      );
                    }

                    let targetNode = nodes.find((n) => n.id === node.nextHopId && !n.isOffline);
                    if (!targetNode) {
                      const peerLink = links.find((l) => (l.fromId === node.id || l.toId === node.id) && l.status !== 'broken');
                      if (peerLink) {
                        const peerId = peerLink.fromId === node.id ? peerLink.toId : peerLink.fromId;
                        targetNode = nodes.find((n) => n.id === peerId);
                      }
                    }
                    if (!targetNode) {
                      targetNode = nodes.find((n) => n.isAnchor) || nodes[0];
                    }

                    const targetCoords = getScreenCoords(targetNode.x, targetNode.y, width, height);
                    const dx = targetCoords.cx - p.cx;
                    const dy = targetCoords.cy - p.cy;
                    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

                    return (
                      <g
                        key={`beam-${node.id}`}
                        transform={`translate(${p.cx}, ${p.cy}) rotate(${angleDeg})`}
                      >
                        <path
                          d="M 0 0 L 44 -18 A 48 48 0 0 1 44 18 Z"
                          fill="#0284c7"
                          fillOpacity="0.22"
                          stroke="#0284c7"
                          strokeWidth="1.4"
                          strokeDasharray="3 2"
                        />
                        <line x1="0" y1="0" x2="46" y2="0" stroke="#38bdf8" strokeWidth="1.5" opacity="0.9" />
                      </g>
                    );
                  })}
              </g>
            );
          })()}
        </svg>
      )}

      {/* HTML Interactive Tactical Node Markers */}
      {containerRef.current &&
        nodes.map((node) => {
          const width = containerRef.current?.clientWidth || 800;
          const height = containerRef.current?.clientHeight || 600;

          const posX = node.isOffline ? (node.lastOnlineX ?? node.x) : node.x;
          const posY = node.isOffline ? (node.lastOnlineY ?? node.y) : node.y;

          const coords = getScreenCoords(posX, posY, width, height);
          const isSelected = selectedNodeId === node.id;
          const isDragging = draggingNodeId === node.id;
          const isOffline = !!node.isOffline;

          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id, node.isAnchor)}
              onClick={() => onSelectNode(node.id)}
              style={{
                left: `${coords.cx}px`,
                top: `${coords.cy}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className={`absolute z-20 flex flex-col items-center select-none transition-transform ${
                isLive || isOffline ? 'cursor-pointer' : 'cursor-grab'
              } ${isDragging ? 'cursor-grabbing scale-115 shadow-xl z-30' : ''}`}
            >
              {/* Pulsing Alert Ring for Disconnected Nodes (Red Circle at Last Online Pos) */}
              {isOffline && (
                <div className="absolute -inset-3 rounded-full border-2 border-red-500/80 animate-ping pointer-events-none" />
              )}

              {/* Node Marker: Circle with Translucent Blue Hologram */}
              <div
                className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all shadow-md backdrop-blur-sm ${
                  isOffline
                    ? 'bg-red-500/25 border-2 border-red-600 text-red-500 shadow-red-500/20 ring-2 ring-red-500/40'
                    : node.isAnchor
                    ? 'bg-slate-950 border-2 border-sky-400 text-white font-bold ring-2 ring-sky-400/30'
                    : isSelected
                    ? 'bg-sky-500/35 border-2 border-sky-400 text-sky-100 font-bold ring-2 ring-sky-400/60 shadow-sky-500/40'
                    : 'bg-sky-500/20 hover:bg-sky-500/30 border-2 border-sky-400 text-sky-200'
                }`}
              >
                {node.isAnchor ? (
                  <Shield className="w-5 h-5 text-sky-400" />
                ) : (
                  <span className="text-[10px] font-black">
                    {node.id.replace('CMD-', 'C')}
                  </span>
                )}

                {/* Status Dot */}
                <div
                  className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${
                    isOffline
                      ? 'bg-red-600 animate-pulse ring-1 ring-red-400'
                      : node.battery > 50
                      ? 'bg-emerald-500 ring-1 ring-emerald-400'
                      : 'bg-amber-500 ring-1 ring-amber-400'
                  }`}
                  title={isOffline ? 'Connection Severed (Scanning)' : 'Connected / Online'}
                />
              </div>

              {/* Callsign Tag */}
              <div
                className={`mt-1.5 px-2 py-0.5 text-[8.5px] text-center font-bold tracking-tight whitespace-nowrap shadow-sm border rounded-sm ${
                  isOffline
                    ? 'bg-red-950/90 border-red-500 text-red-300'
                    : 'bg-slate-900/95 border-tactical-border text-white'
                }`}
              >
                <span>{node.displayName || node.callsign}</span>
                <span className={`ml-1 ${isOffline ? 'text-red-400' : 'text-sky-400'}`}>
                  {isOffline
                    ? '[SEVERED]'
                    : node.isAnchor
                    ? '[TOC]'
                    : `[${node.hopCount ?? 1}H➔${node.nextHopId?.replace('CMD-', 'C')}]`}
                </span>
              </div>
            </div>
          );
        })}

      {/* TOP FLOATING CONSOLE: SIMPLE & CLEAN SIMULATION / SANDBOX CONTROLLER */}
      {!isLive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-2 bg-slate-950/95 border border-slate-800 p-2.5 rounded-sm shadow-2xl backdrop-blur-md max-w-2xl w-[95%] sm:w-[680px]">
          {/* Top Status & Main Controls Row */}
          <div className="w-full flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2 py-0.5 border uppercase ${
                isPlayingSim
                  ? 'bg-amber-950/90 text-amber-300 border-amber-700 animate-pulse'
                  : 'bg-sky-950/90 text-sky-300 border-sky-700'
              }`}>
                {isPlayingSim ? '● SIMULATION' : '🖐 MANUAL DRAG'}
              </span>
              <span className={`text-xs font-bold tracking-wide ${
                !isPlayingSim
                  ? 'text-sky-300'
                  : simTime < 4.5
                  ? 'text-emerald-400'
                  : simTime < 8.5
                  ? 'text-red-400'
                  : simTime < 11.5
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}>
                {isPlayingSim
                  ? (simPhaseName || 'CQB Mesh Simulation')
                  : 'Drag any soldier node around walls to test live RSSI loss'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-extrabold text-tactical-cyan bg-sky-950/80 border border-sky-800 px-2 py-0.5">
                {simTime.toFixed(1)}s / 15.0s
              </span>
              {onOpenEditor && (
                <button
                  onClick={onOpenEditor}
                  className="px-2.5 py-1 bg-gradient-to-r from-purple-950 to-indigo-950 hover:from-purple-900 hover:to-indigo-900 text-purple-300 border border-purple-700 text-xs font-bold uppercase rounded-sm flex items-center gap-1.5 shadow transition-all"
                  title="Add/Delete nodes & walls, record positions, and export JSON"
                >
                  <FileJson className="w-3.5 h-3.5 text-purple-400" />
                  <span>EDIT SIM & JSON</span>
                </button>
              )}
              <button
                onClick={onTogglePlaySim}
                className={`px-3 py-1 flex items-center gap-1.5 text-xs font-black tracking-wider uppercase rounded-sm border shadow-sm transition-all ${
                  isPlayingSim
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400'
                    : 'bg-tactical-cyan hover:bg-sky-600 text-white border-sky-400'
                }`}
              >
                {isPlayingSim ? (
                  <>
                    <Pause className="w-3 h-3 fill-current" />
                    <span>PAUSE & DRAG</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>RUN SIM</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  onResetLayout();
                  if (onSeekSimTime) onSeekSimTime(0.0);
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase rounded-sm border border-slate-700 flex items-center gap-1"
                title="Reset Squad & Simulation"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESET</span>
              </button>
            </div>
          </div>

          {/* Phase Stepper Pills & Interactive Scrubber Track */}
          <div className="w-full flex flex-col gap-1.5">
            <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono uppercase">
              <button
                onClick={() => onSeekSimTime && onSeekSimTime(0.0)}
                className={`px-1.5 py-1 text-center font-bold rounded-sm border transition-all ${
                  simTime < 5.0
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                01: INGRESS (0s)
              </button>
              <button
                onClick={() => onSeekSimTime && onSeekSimTime(5.0)}
                className={`px-1.5 py-1 text-center font-bold rounded-sm border transition-all ${
                  simTime >= 5.0 && simTime < 10.0
                    ? 'bg-red-950 text-red-300 border-red-600 shadow-sm ring-1 ring-red-500/50'
                    : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                02: DUAL-WALL BLOCKED (5s)
              </button>
              <button
                onClick={() => onSeekSimTime && onSeekSimTime(10.0)}
                className={`px-1.5 py-1 text-center font-bold rounded-sm border transition-all ${
                  simTime >= 10.0
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                03: AD-HOC MESH (10s)
              </button>
            </div>

            {/* Interactive Scrubber Track */}
            <div
              onClick={(e) => {
                if (!onSeekSimTime) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, clickX / rect.width));
                onSeekSimTime(parseFloat((pct * 15.0).toFixed(1)));
              }}
              className="relative w-full h-2 bg-slate-800/80 rounded-full cursor-pointer overflow-hidden border border-slate-700/80"
              title="Click or drag to scrub 15-second mission"
            >
              <div
                style={{ width: `${(simTime / 15.0) * 100}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 via-red-500 to-emerald-500 transition-all duration-75"
              />
            </div>
          </div>
        </div>
      )}

      {/* RSSI Signal Quality Color Legend (Bottom Left) */}
      {!isLive && (
        <div className="absolute bottom-3 left-3 z-20 pointer-events-auto bg-slate-900/95 border border-tactical-border px-3 py-1.5 text-[10px] text-slate-300 flex flex-wrap items-center gap-3 shadow-md font-mono">
          <span className="font-bold text-white uppercase">LINK RSSI:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span className="text-emerald-400 font-semibold">≥ -60 dBm (Strong)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm" />
            <span className="text-cyan-400 font-semibold">-60 to -72 dBm (Good)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
            <span className="text-amber-400 font-semibold">-72 to -82 dBm (Fair)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
            <span className="text-red-400 font-semibold">&lt; -82 dBm (Blocked)</span>
          </span>
        </div>
      )}

      {/* Manual Mode Drag & Drop Hint */}
      {!isPlayingSim && !isLive && (
        <div className="absolute bottom-12 left-3 z-20 pointer-events-auto bg-sky-950/90 border border-sky-600/80 px-3 py-1.5 text-[11px] text-sky-200 flex items-center gap-2 shadow-lg font-mono">
          <span>💡</span>
          <span>
            <strong>Interactive Sandbox:</strong> Drag <strong>ALPHA-POINT</strong> away from <strong>BRAVO</strong> to see RSSI drop; drag behind the wall to see signal autonomously re-route through <strong>CHARLIE</strong> around the obstacle!
          </span>
        </div>
      )}

      {/* Bottom Floating Tactical Banner (Live Mode Only) */}
      {isLive && (
        <div className="absolute bottom-2 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
          <div className="bg-slate-900/95 border border-tactical-border px-3 py-1.5 text-[11px] text-slate-300 flex items-center gap-2 pointer-events-auto shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">
              LIVE HW MODE: Ingesting real received ESP32 packets only.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};


