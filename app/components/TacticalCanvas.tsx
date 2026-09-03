'use client';

import React, { useRef, useState, useCallback } from 'react';
import { TacticalNode, NodeLink, ObstacleWall, GhostNode, OperationalMode, JammerState } from '../types/tactical';
import { Crosshair, Shield, RotateCcw, AlertTriangle, Move, Focus } from 'lucide-react';
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(20);
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
      className={`relative w-full h-[600px] bg-[#f8fafc] border border-tactical-border overflow-hidden select-none font-mono shadow-none ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Tactical Light Grid Background */}
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
        <div className="bg-white/95 border border-tactical-border px-3 py-1.5 text-xs flex items-center gap-2 shadow-sm">
          <Crosshair className="w-3.5 h-3.5 text-tactical-cyan" />
          <span className="text-tactical-textMuted">MAP DATUM:</span>
          <span className="text-tactical-textBright font-bold">REL-GRID TANK-00 (0,0)</span>
          <span className="text-[10px] text-tactical-cyan ml-2 bg-sky-50 border border-sky-200 px-1.5 font-semibold">
            PAN: ({Math.round(panOffset.x)}px, {Math.round(panOffset.y)}px)
          </span>
        </div>

        {/* Tactical Toolbar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowRings(!showRings)}
            className={`px-2 py-1 text-[11px] border font-semibold ${
              showRings
                ? 'bg-white text-tactical-textBright border-tactical-border'
                : 'bg-tactical-panel text-tactical-textMuted border-tactical-borderLight'
            }`}
          >
            RANGE RINGS
          </button>
          <button
            onClick={() => setShowSectors(!showSectors)}
            className={`px-2 py-1 text-[11px] border font-semibold ${
              showSectors
                ? 'bg-white text-tactical-textBright border-tactical-border'
                : 'bg-tactical-panel text-tactical-textMuted border-tactical-borderLight'
            }`}
          >
            ADHOC BEAMS
          </button>
          <button
            onClick={handleResetPan}
            title="Reset Pan & Center"
            className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-tactical-border text-slate-800 flex items-center gap-1 font-semibold"
          >
            <Focus className="w-3 h-3 text-tactical-cyan" />
            RE-CENTER
          </button>
          {!isLive && (
            <button
              onClick={onResetLayout}
              className="px-2 py-1 text-[11px] bg-tactical-panel hover:bg-slate-200 border border-tactical-border text-tactical-textLight flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              RESET SQUAD
            </button>
          )}
        </div>
      </div>

      {/* Top Center Zoom Controls */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/95 border border-tactical-border p-1 shadow-sm pointer-events-auto">
        <button
          onClick={() => setZoom((prev) => Math.max(10, prev - 2))}
          className="px-2 py-0.5 text-xs text-tactical-textMuted hover:text-tactical-textBright hover:bg-tactical-panel font-bold"
        >
          -
        </button>
        <span className="text-[10px] text-tactical-textLight px-1.5 font-bold">{zoom}x</span>
        <button
          onClick={() => setZoom((prev) => Math.min(36, prev + 2))}
          className="px-2 py-0.5 text-xs text-tactical-textMuted hover:text-tactical-textBright hover:bg-tactical-panel font-bold"
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
                  stroke="#cbd5e1"
                  strokeWidth="1"
                />
                <line
                  x1={center.cx}
                  y1={0}
                  x2={center.cx}
                  y2={height}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                />

                {/* Render Obstacle Concrete Barriers */}
                {displayWalls.map((wall) => {
                  const p1 = getScreenCoords(wall.x1, wall.y1, width, height);
                  const p2 = getScreenCoords(wall.x2, wall.y2, width, height);
                  return (
                    <g
                      key={wall.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => onToggleWall(wall.id)}
                    >
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#fee2e2"
                        strokeWidth="14"
                        strokeLinecap="round"
                      />
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#dc2626"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                      <text
                        x={(p1.cx + p2.cx) / 2}
                        y={(p1.cy + p2.cy) / 2 - 10}
                        fill="#b91c1c"
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        REINFORCED CONCRETE (-{wall.attenuationDb}dB)
                      </text>
                    </g>
                  );
                })}

                {/* Render Active Ad-Hoc Multi-Hop Mesh Links */}
                {links.map((link) => {
                  const fromNode = nodes.find((n) => n.id === link.fromId);
                  const toNode = nodes.find((n) => n.id === link.toId);
                  if (!fromNode || !toNode) return null;

                  const p1 = getScreenCoords(fromNode.x, fromNode.y, width, height);
                  const p2 = getScreenCoords(toNode.x, toNode.y, width, height);

                  let strokeColor = '#0284c7'; // Active Ad-Hoc Mesh Cobalt
                  let strokeDash = 'none';
                  let strokeWidth = 2.5;

                  if (link.status === 'degraded') {
                    strokeColor = '#d97706';
                    strokeDash = '6 3';
                    strokeWidth = 2;
                  } else if (link.status === 'critical' || link.status === 'broken') {
                    strokeColor = '#dc2626';
                    strokeDash = '4 3';
                    strokeWidth = 1.5;
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
                        strokeOpacity={link.status === 'broken' ? 0.35 : 0.9}
                      />
                      {/* Directional Ad-Hoc Hop Arrow */}
                      <circle cx={(p1.cx * 0.4 + p2.cx * 0.6)} cy={(p1.cy * 0.4 + p2.cy * 0.6)} r="3" fill={strokeColor} />
                      
                      <rect
                        x={midX - 32}
                        y={midY - 9}
                        width="64"
                        height="18"
                        fill="#ffffff"
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        fill={strokeColor}
                        fontSize="8.5"
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {link.sinrDb}dB ({link.distanceMeters}m)
                      </text>
                    </g>
                  );
                })}

                {/* Render Ghost Nodes (Ad-Hoc Network Healing Projection) */}
                {ghostNodes.map((ghost) => {
                  const curr = getScreenCoords(ghost.currentX, ghost.currentY, width, height);
                  const opt = getScreenCoords(ghost.optimalX, ghost.optimalY, width, height);

                  return (
                    <g key={`ghost-${ghost.targetNodeId}`}>
                      <line
                        x1={curr.cx}
                        y1={curr.cy}
                        x2={opt.cx}
                        y2={opt.cy}
                        stroke="#dc2626"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />

                      <circle
                        cx={opt.cx}
                        cy={opt.cy}
                        r="18"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                      <circle
                        cx={opt.cx}
                        cy={opt.cy}
                        r="12"
                        fill="#fee2e2"
                        fillOpacity="0.8"
                        stroke="#dc2626"
                        strokeWidth="2"
                      />
                      <circle cx={opt.cx} cy={opt.cy} r="4" fill="#dc2626" />

                      <g transform={`translate(${opt.cx + 18}, ${opt.cy - 12})`}>
                        <rect
                          x="0"
                          y="0"
                          width="185"
                          height="36"
                          fill="#ffffff"
                          stroke="#dc2626"
                          strokeWidth="1.5"
                        />
                        <text
                          x="8"
                          y="14"
                          fill="#991b1b"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          GHOST WAYPOINT: {ghost.targetCallsign}
                        </text>
                        <text
                          x="8"
                          y="28"
                          fill="#dc2626"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {ghost.shiftCardinal} (+{ghost.predictedSinrGainDb}dB SINR)
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Conformal Beam Sector Cones (AIMED EXACTLY AT DIRECT AD-HOC UPSTREAM PARENT) */}
                {showSectors &&
                  nodes.map((node) => {
                    if (node.isAnchor) return null;
                    const p = getScreenCoords(node.x, node.y, width, height);
                    const parent = nodes.find((n) => n.id === node.nextHopId) || nodes[0];
                    const parentCoords = getScreenCoords(parent.x, parent.y, width, height);
                    
                    // Exact angle towards direct upstream ad-hoc mesh parent
                    const dx = parentCoords.cx - p.cx;
                    const dy = parentCoords.cy - p.cy;
                    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

                    return (
                      <g
                        key={`beam-${node.id}`}
                        transform={`translate(${p.cx}, ${p.cy}) rotate(${angleDeg})`}
                      >
                        <path
                          d="M 0 0 L 38 -15 A 42 42 0 0 1 38 15 Z"
                          fill="#0284c7"
                          fillOpacity="0.18"
                          stroke="#0284c7"
                          strokeWidth="1.2"
                          strokeDasharray="2 2"
                        />
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
          const coords = getScreenCoords(node.x, node.y, width, height);
          const isSelected = selectedNodeId === node.id;
          const isDragging = draggingNodeId === node.id;

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
              className={`absolute z-20 flex flex-col items-center select-none ${
                isLive ? 'cursor-pointer' : 'cursor-grab'
              } ${isDragging ? 'cursor-grabbing scale-110 shadow-lg' : ''}`}
            >
              {/* Node Marker Box */}
              <div
                className={`relative flex items-center justify-center w-8 h-8 border transition-all ${
                  node.isAnchor
                    ? 'bg-slate-900 border-slate-900 text-white font-bold'
                    : isSelected
                    ? 'bg-white border-2 border-slate-900 text-slate-950 font-bold'
                    : 'bg-white border border-tactical-border text-slate-800 hover:border-slate-800'
                }`}
              >
                {node.isAnchor ? (
                  <Shield className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-[10px] font-bold">
                    {node.id.replace('CMD-', 'C')}
                  </span>
                )}

                {/* Status Dot */}
                <div
                  className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white ${
                    node.battery > 50
                      ? 'bg-tactical-green'
                      : node.battery > 20
                      ? 'bg-tactical-amber'
                      : 'bg-tactical-crimson animate-ping'
                  }`}
                />
              </div>

              {/* Callsign Tag with Hop Count */}
              <div className="mt-1 bg-white border border-tactical-border px-1.5 py-0.5 text-[8.5px] text-center font-bold tracking-tight whitespace-nowrap shadow-none">
                <span className="text-slate-900">{node.callsign}</span>
                <span className="text-sky-700 ml-1">
                  [{node.isAnchor ? 'TOC' : `${node.hopCount ?? 1}H➔${node.nextHopId?.replace('CMD-', 'C')}`}]
                </span>
              </div>
            </div>
          );
        })}

      {/* Bottom Floating Tactical Banner */}
      <div className="absolute bottom-2 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="bg-white/95 border border-tactical-border px-3 py-1.5 text-[11px] text-slate-600 flex items-center gap-2 pointer-events-auto shadow-sm">
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-tactical-green animate-pulse' : 'bg-sky-600'}`} />
          <span className="font-medium">
            {isLive
              ? 'LIVE HW MODE: Ingesting real received ESP32 packets only. (Simulation tools locked)'
              : 'PANNING ACTIVE: Click & drag background to pan battlefield. Beams dynamically track ad-hoc mesh parents.'}
          </span>
        </div>

        {ghostNodes.length > 0 && (
          <div className="bg-red-50 border border-tactical-crimson px-3 py-1.5 text-xs text-red-800 font-bold flex items-center gap-2 pointer-events-auto shadow-sm">
            <AlertTriangle className="w-4 h-4 text-tactical-crimson" />
            <span>
              {ghostNodes.length} AD-HOC GHOST REPOSITIONING WAYPOINT(S) PROJECTED
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
