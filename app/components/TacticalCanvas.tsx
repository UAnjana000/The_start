'use client';

import React, { useRef, useState, useCallback } from 'react';
import { TacticalNode, NodeLink, ObstacleWall, GhostNode, OperationalMode, JammerState } from '../types/tactical';
import { Crosshair, Shield, RotateCcw, AlertTriangle, Move, Focus, Play, Pause } from 'lucide-react';
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
          {!isLive && (
            <button
              onClick={onResetLayout}
              className="px-2 py-1 text-[11px] bg-tactical-panel dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-tactical-border text-tactical-textLight flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              RESET SQUAD
            </button>
          )}
        </div>
      </div>

      {/* Top Center Zoom Controls */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 border border-tactical-border p-1 shadow-sm pointer-events-auto">
        <button
          onClick={() => setZoom((prev) => Math.max(10, prev - 2))}
          className="px-2 py-0.5 text-xs text-tactical-textMuted hover:text-tactical-textBright hover:bg-tactical-panel dark:hover:bg-slate-800 font-bold"
        >
          -
        </button>
        <span className="text-[10px] text-tactical-textLight px-1.5 font-bold">{zoom}x</span>
        <button
          onClick={() => setZoom((prev) => Math.min(36, prev + 2))}
          className="px-2 py-0.5 text-xs text-tactical-textMuted hover:text-tactical-textBright hover:bg-tactical-panel dark:hover:bg-slate-800 font-bold"
        >
          +
        </button>
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

                {/* Render Obstacle Concrete Barriers with High-Tech Hazard Crosshatch */}
                {displayWalls.map((wall) => {
                  const p1 = getScreenCoords(wall.x1, wall.y1, width, height);
                  const p2 = getScreenCoords(wall.x2, wall.y2, width, height);
                  return (
                    <g
                      key={wall.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => onToggleWall(wall.id)}
                    >
                      {/* Outer Hazard Halo */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#450a0a"
                        strokeWidth="18"
                        strokeLinecap="square"
                        opacity="0.6"
                      />
                      {/* Concrete Wall Core */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#991b1b"
                        strokeWidth="8"
                        strokeLinecap="square"
                      />
                      {/* Warning Stripe Center */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                        strokeDasharray="5 5"
                      />
                      <text
                        x={(p1.cx + p2.cx) / 2}
                        y={(p1.cy + p2.cy) / 2 - 12}
                        fill="#ef4444"
                        fontSize="9.5"
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontWeight="extrabold"
                        className="tracking-wider drop-shadow"
                      >
                        REINFORCED CONCRETE 0.35m (-{wall.attenuationDb}dB)
                      </text>
                    </g>
                  );
                })}

                {/* PHASE 2 SPECIAL: Fragmented Glowing Red Connection Line behind Concrete Wall */}
                {mode === 'simulation' && simTime >= 4.5 && simTime < 8.5 && (
                  <g>
                    {(() => {
                      const pTOC = getScreenCoords(0, 0, width, height);
                      const alpha = nodes.find((n) => n.id === 'CMD-01');
                      const pAlpha = getScreenCoords(alpha?.x ?? 14, alpha?.y ?? 7.8, width, height);
                      return (
                        <g>
                          {/* Fragmented Flickering Red Line */}
                          <line
                            x1={pTOC.cx}
                            y1={pTOC.cy}
                            x2={pAlpha.cx}
                            y2={pAlpha.cy}
                            stroke="#ef4444"
                            strokeWidth="3"
                            strokeDasharray="8 6"
                          >
                            <animate
                              attributeName="opacity"
                              values="0.9;0.15;0.85;0.2;0.9"
                              dur="0.5s"
                              repeatCount="indefinite"
                            />
                          </line>
                          <circle
                            cx={(pTOC.cx + pAlpha.cx) / 2}
                            cy={(pTOC.cy + pAlpha.cy) / 2}
                            r="6"
                            fill="#ef4444"
                            className="animate-ping"
                          />
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* PHASE 4 SPECIAL: Snapped Brilliant 2-Hop Bounced Mesh Line around Wall Corner */}
                {mode === 'simulation' && simTime >= 11.5 && (
                  <g>
                    {(() => {
                      const pTOC = getScreenCoords(0, 0, width, height);
                      const pCorner = getScreenCoords(8.0, 4.5, width, height);
                      const alpha = nodes.find((n) => n.id === 'CMD-01');
                      const pAlpha = getScreenCoords(alpha?.x ?? 14, alpha?.y ?? 7.8, width, height);

                      return (
                        <g>
                          {/* Hop 1: TOC -> Corner Ghost */}
                          <line
                            x1={pTOC.cx}
                            y1={pTOC.cy}
                            x2={pCorner.cx}
                            y2={pCorner.cy}
                            stroke="#38bdf8"
                            strokeWidth="4"
                            strokeOpacity="0.9"
                          />
                          <line
                            x1={pTOC.cx}
                            y1={pTOC.cy}
                            x2={pCorner.cx}
                            y2={pCorner.cy}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />

                          {/* Hop 2: Corner Ghost -> ALPHA-POINT (Bounced Around Wall) */}
                          <line
                            x1={pCorner.cx}
                            y1={pCorner.cy}
                            x2={pAlpha.cx}
                            y2={pAlpha.cy}
                            stroke="#38bdf8"
                            strokeWidth="4"
                            strokeOpacity="0.9"
                          />
                          <line
                            x1={pCorner.cx}
                            y1={pCorner.cy}
                            x2={pAlpha.cx}
                            y2={pAlpha.cy}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />

                          {/* Corner Reflection Spark */}
                          <circle cx={pCorner.cx} cy={pCorner.cy} r="8" fill="#38bdf8" fillOpacity="0.4" className="animate-ping" />
                          <circle cx={pCorner.cx} cy={pCorner.cy} r="4" fill="#ffffff" />
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* Render Active Ad-Hoc Multi-Hop Mesh Links */}
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

                  const isOfflineLink = fromNode.isOffline || toNode.isOffline;
                  let strokeColor = isOfflineLink ? '#dc2626' : '#0284c7';
                  let strokeDash = isOfflineLink ? '4 4' : 'none';
                  let strokeWidth = isOfflineLink ? 1.5 : 2.5;

                  if (!isOfflineLink) {
                    if (link.status === 'degraded') {
                      strokeColor = '#d97706';
                      strokeDash = '6 3';
                      strokeWidth = 2;
                    } else if (link.status === 'critical' || link.status === 'broken') {
                      strokeColor = '#dc2626';
                      strokeDash = '4 3';
                      strokeWidth = 1.5;
                    }
                  }

                  const midX = (p1.cx + p2.cx) / 2;
                  const midY = (p1.cy + p2.cy) / 2;

                  return (
                    <g key={`${link.fromId}-${link.toId}`}>
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDash}
                        strokeOpacity={isOfflineLink || link.status === 'broken' ? 0.35 : 0.9}
                      />
                      {!isOfflineLink && (
                        <circle cx={(p1.cx * 0.4 + p2.cx * 0.6)} cy={(p1.cy * 0.4 + p2.cy * 0.6)} r="3" fill={strokeColor} />
                      )}
                      
                      <rect
                        x={midX - 34}
                        y={midY - 9}
                        width="68"
                        height="18"
                        fill="#0f172a"
                        stroke={strokeColor}
                        strokeWidth="1"
                        rx="2"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        fill={isOfflineLink ? '#ef4444' : '#38bdf8'}
                        fontSize="8.5"
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {isOfflineLink ? 'SEVERED' : `${link.sinrDb}dB (${link.distanceMeters}m)`}
                      </text>
                    </g>
                  );
                })}

                {/* Render Ghost Nodes (Pulsing Green Holographic Relay at Corner in Phase 3/4) */}
                {ghostNodes.map((ghost) => {
                  const opt = getScreenCoords(ghost.optimalX, ghost.optimalY, width, height);

                  return (
                    <g key={`ghost-${ghost.targetNodeId}`} transform={`translate(${opt.cx}, ${opt.cy})`}>
                      {/* Concentric Green Sonar Expanding Waves */}
                      <circle r="36" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                      <circle r="24" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.6" className="animate-ping" />
                      <circle r="12" fill="#10b981" fillOpacity="0.25" stroke="#10b981" strokeWidth="2" />
                      <circle r="4" fill="#10b981" />

                      {/* Ghost Waypoint Hologram Badge */}
                      <g transform="translate(18, -14)">
                        <rect
                          x="0"
                          y="0"
                          width="185"
                          height="34"
                          fill="#064e3b"
                          stroke="#10b981"
                          strokeWidth="1.5"
                          rx="2"
                        />
                        <text
                          x="8"
                          y="13"
                          fill="#a7f3d0"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          ✦ GHOST RELAY: {ghost.targetCallsign}
                        </text>
                        <text
                          x="8"
                          y="26"
                          fill="#34d399"
                          fontSize="8.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          WALL CORNER (8.0, 4.5) // +22.4dB HEAL
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

      {/* TOP CENTER: 15-SECOND NSG TACTICAL CQB MISSION HUD */}
      {!isLive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1">
          <div className="bg-slate-950/90 border border-tactical-border px-4 py-1.5 rounded-sm flex items-center gap-3 shadow-xl backdrop-blur-md">
            <span className="text-[10px] font-black bg-red-950 text-red-400 border border-red-800 px-2 py-0.5">
              NSG 51 SAG // CQB
            </span>
            <span className="text-xs font-bold text-white tracking-wide">
              {simPhaseName || '15s TACTICAL CQB GHOST RELAY SIMULATION'}
            </span>
            <span className="text-xs font-mono font-extrabold text-tactical-cyan bg-sky-950/80 border border-sky-800 px-2 py-0.5">
              {simTime.toFixed(1)}s / 15.0s
            </span>
          </div>
        </div>
      )}

      {/* BOTTOM CENTER: 15-SECOND CINEMATIC MISSION TIMELINE CONTROLLER */}
      {!isLive && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-2 bg-slate-950/95 border border-slate-800 p-2.5 rounded-sm shadow-2xl backdrop-blur-md max-w-2xl w-[95%] sm:w-[650px]">
          {/* Progress Timeline Bar with Phase Markers */}
          <div className="w-full flex flex-col gap-1">
            <div className="flex justify-between text-[9px] font-mono text-slate-400 uppercase">
              <span
                onClick={() => onSeekSimTime && onSeekSimTime(0.0)}
                className={`cursor-pointer hover:text-white ${simTime < 4.5 ? 'text-sky-400 font-bold' : ''}`}
              >
                01: INGRESS (0s)
              </span>
              <span
                onClick={() => onSeekSimTime && onSeekSimTime(4.5)}
                className={`cursor-pointer hover:text-white ${simTime >= 4.5 && simTime < 8.5 ? 'text-red-400 font-bold' : ''}`}
              >
                02: SEVERED (4.5s)
              </span>
              <span
                onClick={() => onSeekSimTime && onSeekSimTime(8.5)}
                className={`cursor-pointer hover:text-white ${simTime >= 8.5 && simTime < 11.5 ? 'text-amber-400 font-bold' : ''}`}
              >
                03: GHOST DROP (8.5s)
              </span>
              <span
                onClick={() => onSeekSimTime && onSeekSimTime(11.5)}
                className={`cursor-pointer hover:text-white ${simTime >= 11.5 ? 'text-emerald-400 font-bold' : ''}`}
              >
                04: HEALED (11.5s)
              </span>
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
              className="relative w-full h-2.5 bg-slate-800 rounded-full cursor-pointer overflow-hidden border border-slate-700"
            >
              <div
                style={{ width: `${(simTime / 15.0) * 100}%` }}
                className="h-full bg-gradient-to-r from-sky-500 via-amber-500 to-emerald-500 transition-all duration-75"
              />
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onTogglePlaySim}
              className={`px-5 py-1.5 flex items-center gap-2 text-xs font-black tracking-wider uppercase rounded-sm border shadow-md transition-all ${
                isPlayingSim
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400'
                  : 'bg-tactical-cyan hover:bg-sky-600 text-white border-sky-400'
              }`}
            >
              {isPlayingSim ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>PAUSE (15s LOOP)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>RUN NSG SIMULATION</span>
                </>
              )}
            </button>

            <button
              onClick={() => onSeekSimTime && onSeekSimTime(0.0)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase rounded-sm border border-slate-700 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESTART</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Floating Tactical Banner */}
      <div className="absolute bottom-2 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/95 border border-tactical-border px-3 py-1.5 text-[11px] text-slate-300 flex items-center gap-2 pointer-events-auto shadow-sm">
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-sky-500'}`} />
          <span className="font-medium">
            {isLive
              ? 'LIVE HW MODE: Ingesting real received ESP32 packets only.'
              : 'NSG 51 SAG CQB: Top-down dark building floorplan • Operatives moving behind concrete barrier.'}
          </span>
        </div>
      </div>
    </div>
  );
};


