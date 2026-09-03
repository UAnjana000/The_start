'use client';

import React, { useState, useRef, useCallback } from 'react';
import { GitFork, Radio, Shield, Activity, Cpu, Play, Pause, Database, Layers, Move, RotateCcw } from 'lucide-react';

interface UmlBox {
  id: string;
  stereotype: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  headerColor: string;
  textColor: string;
  badge: string;
  attributes: string[];
  methods: string[];
}

const INITIAL_UML_BOXES: UmlBox[] = [
  {
    id: 'xiao_c6',
    stereotype: '«XIAO_ESP32C6»',
    title: 'Helmet Commando Node',
    x: 20,
    y: 20,
    width: 220,
    height: 200,
    headerColor: '#f0f9ff',
    textColor: '#0284c7',
    badge: 'NODE ID [1..5]',
    attributes: [
      '+ GPIO 3 (LOW) // Enable RF switch',
      '+ GPIO 14 (HIGH) // u.FL Ext Port',
      '+ Pin 4 (D4/GPIO22) // AS179 V1',
      '+ Pin 5 (D5/GPIO23) // AS179 V2',
      '+ GPS Datum: (lat, lon)',
      '+ Tx Power: 20.0 dBm',
    ],
    methods: [
      '+ routeToExternalUfl()',
      '+ evaluateAntennas() [Hysteresis]',
      '+ sendTelemetry(32B MeshPacket)',
      '+ relayPop() [TTL=3 Hop Relay]',
    ],
  },
  {
    id: 'as179_switch',
    stereotype: '«AS179_92LF»',
    title: 'SPDT RF Switch',
    x: 275,
    y: 40,
    width: 200,
    height: 165,
    headerColor: '#fef3c7',
    textColor: '#d97706',
    badge: 'HARDWARE RF',
    attributes: [
      '+ RFC: Connected to u.FL port',
      '+ V1=HIGH, V2=LOW -> Ant 1 (Front)',
      '+ V1=LOW, V2=HIGH -> Ant 2 (Rear)',
      '+ Settling Time: 5ms',
      '+ Hysteresis Margin: 4 dB',
    ],
    methods: [
      '+ selectAntenna(1 | 2)',
      '+ routeRF1(Sector Front)',
      '+ routeRF2(Sector Rear)',
    ],
  },
  {
    id: 'esp32_gateway',
    stereotype: '«ESP32_Gateway»',
    title: 'TOC Mesh Gateway Sink',
    x: 510,
    y: 20,
    width: 225,
    height: 200,
    headerColor: '#f0fdf4',
    textColor: '#16a34a',
    badge: 'TOC ANCHOR (0,0)',
    attributes: [
      '+ SoftAP: "MESH-GW" (Beacon)',
      '+ STA: Home/Field Router Uplink',
      '+ RxQueue[24]: Lock-free ISR',
      '+ Deduplication: Rolling Seq No.',
      '+ NodeRec table: max 16 nodes',
      '+ Insecure SSL Client (Fast dev)',
    ],
    methods: [
      '+ onEspNowRecv() [Rx ISR]',
      '+ handlePacket(bestPath, hops)',
      '+ uploadAll() [HTTPS PATCH 5s]',
    ],
  },
  {
    id: 'firebase_rtdb',
    stereotype: '«Firebase_RTDB»',
    title: 'Cloud Realtime Ingress',
    x: 770,
    y: 35,
    width: 215,
    height: 175,
    headerColor: '#fff1f2',
    textColor: '#e11d48',
    badge: 'REST / SSE ENDPOINT',
    attributes: [
      '+ DB: apparatus-certified-default-rtdb',
      '+ Path: /nodes.json',
      '+ Data: {lat, lon, rssi, antenna, hops}',
      '+ Watchdog: 15s Heartbeat Limit',
      '+ ServerTimestamp: .sv="timestamp"',
    ],
    methods: [
      '+ onValue() [3s Sync Stream]',
      '+ flagOfflineStaleNodes(>15s)',
    ],
  },
  {
    id: 'c2_console',
    stereotype: '«C2_Console»',
    title: 'Tactical C2 Mission Console',
    x: 1020,
    y: 20,
    width: 220,
    height: 200,
    headerColor: '#f8fafc',
    textColor: '#4f46e5',
    badge: 'NEXT.JS 14 C2',
    attributes: [
      '+ 2D Canvas Viewport (60 FPS)',
      '+ Translucent Blue: Online Nodes',
      '+ Red Circle: Lost @ Last Online Pos',
      '+ B.A.T.M.A.N. Mesh Routing Core',
      '+ PiP L-Band Tactical Video Feed',
    ],
    methods: [
      '+ parseFirebaseNodes()',
      '+ gpsToLocalGrid(lat, lon)',
      '+ renderAdHocMesh()',
      '+ dispatchGhostHealer()',
    ],
  },
];

export const DataFlowDiagram: React.FC = () => {
  const [boxes, setBoxes] = useState<UmlBox[]>(INITIAL_UML_BOXES);
  const [animating, setAnimating] = useState<boolean>(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Mouse / Touch handlers for dragging UML stereotype boxes
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const box = boxes.find((b) => b.id === id);
    if (!box || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * 1280;
    const svgY = ((e.clientY - rect.top) / rect.height) * 270;

    setDraggingId(id);
    setDragOffset({ x: svgX - box.x, y: svgY - box.y });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * 1280;
      const svgY = ((e.clientY - rect.top) / rect.height) * 270;

      const newX = Math.max(10, Math.min(1280 - 220, svgX - dragOffset.x));
      const newY = Math.max(10, Math.min(270 - 150, svgY - dragOffset.y));

      setBoxes((prev) =>
        prev.map((b) => (b.id === draggingId ? { ...b, x: Math.round(newX), y: Math.round(newY) } : b))
      );
    },
    [draggingId, dragOffset]
  );

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const handleResetPositions = () => {
    setBoxes(INITIAL_UML_BOXES);
  };

  // Helper to get connection points between boxes
  const getBoxEdges = (srcId: string, tgtId: string) => {
    const src = boxes.find((b) => b.id === srcId) || boxes[0];
    const tgt = boxes.find((b) => b.id === tgtId) || boxes[1];

    const srcCenterX = src.x + src.width;
    const srcCenterY = src.y + src.height / 2;
    const tgtCenterX = tgt.x;
    const tgtCenterY = tgt.y + tgt.height / 2;

    return {
      x1: srcCenterX,
      y1: srcCenterY,
      x2: tgtCenterX,
      y2: tgtCenterY,
    };
  };

  const conn1 = getBoxEdges('xiao_c6', 'as179_switch');
  const conn2 = getBoxEdges('as179_switch', 'esp32_gateway');
  const conn3 = getBoxEdges('esp32_gateway', 'firebase_rtdb');
  const conn4 = getBoxEdges('firebase_rtdb', 'c2_console');

  // Feedback loop from C2 Console back to Helmet Node
  const c2Box = boxes.find((b) => b.id === 'c2_console') || boxes[4];
  const xiaoBox = boxes.find((b) => b.id === 'xiao_c6') || boxes[0];
  const loopX1 = c2Box.x + c2Box.width / 2;
  const loopY1 = c2Box.y + c2Box.height;
  const loopX2 = xiaoBox.x + xiaoBox.width / 2;
  const loopY2 = xiaoBox.y + xiaoBox.height;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="bg-white dark:bg-slate-900 border border-tactical-border font-mono text-xs select-none p-3 shadow-sm flex flex-col gap-2"
    >
      {/* Header with Controls */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-2 mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-tactical-cyan" />
          <span className="font-bold tracking-wider text-slate-900 dark:text-white text-[11.5px] uppercase">
            INTERACTIVE MOVEABLE UML ARCHITECTURE // ESP32-C6 &amp; FIREBASE RTDB PIPELINE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetPositions}
            className="px-2.5 py-1 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>RESET POSITIONS</span>
          </button>
        </div>
      </div>

      {/* Interactive Drag-and-Drop SVG UML Canvas */}
      <div className="relative w-full bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 p-2 overflow-x-auto rounded-sm">
        <svg
          ref={svgRef}
          viewBox="0 0 1280 270"
          className="w-full min-w-[960px] h-auto font-mono cursor-crosshair select-none"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
            </marker>
            <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
            </marker>
            <marker id="arrow-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>
            <marker id="arrow-crimson" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
          </defs>

          {/* Dynamic UML Association Connectors */}
          {/* Connector 1: Xiao C6 -> AS179 */}
          <path
            d={`M ${conn1.x1} ${conn1.y1} C ${(conn1.x1 + conn1.x2) / 2} ${conn1.y1}, ${(conn1.x1 + conn1.x2) / 2} ${conn1.y2}, ${conn1.x2} ${conn1.y2}`}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2"
            strokeDasharray={animating ? '4 3' : 'none'}
            markerEnd="url(#arrow)"
          />

          {/* Connector 2: AS179 -> ESP32 Gateway */}
          <path
            d={`M ${conn2.x1} ${conn2.y1} C ${(conn2.x1 + conn2.x2) / 2} ${conn2.y1}, ${(conn2.x1 + conn2.x2) / 2} ${conn2.y2}, ${conn2.x2} ${conn2.y2}`}
            fill="none"
            stroke="#d97706"
            strokeWidth="2"
            strokeDasharray={animating ? '4 3' : 'none'}
            markerEnd="url(#arrow-amber)"
          />

          {/* Connector 3: Gateway -> Firebase RTDB */}
          <path
            d={`M ${conn3.x1} ${conn3.y1} C ${(conn3.x1 + conn3.x2) / 2} ${conn3.y1}, ${(conn3.x1 + conn3.x2) / 2} ${conn3.y2}, ${conn3.x2} ${conn3.y2}`}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2"
            strokeDasharray={animating ? '4 3' : 'none'}
            markerEnd="url(#arrow)"
          />

          {/* Connector 4: Firebase RTDB -> C2 Console */}
          <path
            d={`M ${conn4.x1} ${conn4.y1} C ${(conn4.x1 + conn4.x2) / 2} ${conn4.y1}, ${(conn4.x1 + conn4.x2) / 2} ${conn4.y2}, ${conn4.x2} ${conn4.y2}`}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray={animating ? '4 3' : 'none'}
            markerEnd="url(#arrow-emerald)"
          />

          {/* Feedback Watchdog Path: C2 Console -> Inactive Watchdog -> Helmet */}
          <path
            d={`M ${loopX1} ${loopY1} L ${loopX1} 245 L ${loopX2} 245 L ${loopX2} ${loopY2}`}
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray={animating ? '5 4' : 'none'}
            markerEnd="url(#arrow-crimson)"
          />

          {/* Animated Data Packets Flowing dynamically along paths */}
          {animating && (
            <>
              {/* Packet 1: RF Switch Control */}
              <circle r="4" fill="#0284c7">
                <animateMotion
                  path={`M ${conn1.x1} ${conn1.y1} C ${(conn1.x1 + conn1.x2) / 2} ${conn1.y1}, ${(conn1.x1 + conn1.x2) / 2} ${conn1.y2}, ${conn1.x2} ${conn1.y2}`}
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Packet 2: 32B ESP-NOW MeshPacket */}
              <circle r="4" fill="#d97706">
                <animateMotion
                  path={`M ${conn2.x1} ${conn2.y1} C ${(conn2.x1 + conn2.x2) / 2} ${conn2.y1}, ${(conn2.x1 + conn2.x2) / 2} ${conn2.y2}, ${conn2.x2} ${conn2.y2}`}
                  dur="1.4s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Packet 3: HTTPS PATCH /nodes.json */}
              <circle r="4" fill="#0284c7">
                <animateMotion
                  path={`M ${conn3.x1} ${conn3.y1} C ${(conn3.x1 + conn3.x2) / 2} ${conn3.y1}, ${(conn3.x1 + conn3.x2) / 2} ${conn3.y2}, ${conn3.x2} ${conn3.y2}`}
                  dur="1.3s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Packet 4: SSE / REST Stream Sync (3s) */}
              <circle r="4" fill="#10b981">
                <animateMotion
                  path={`M ${conn4.x1} ${conn4.y1} C ${(conn4.x1 + conn4.x2) / 2} ${conn4.y1}, ${(conn4.x1 + conn4.x2) / 2} ${conn4.y2}, ${conn4.x2} ${conn4.y2}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Packet 5: 15-Second Inactivity Watchdog Loop */}
              <circle r="4" fill="#ef4444">
                <animateMotion
                  path={`M ${loopX1} ${loopY1} L ${loopX1} 245 L ${loopX2} 245 L ${loopX2} ${loopY2}`}
                  dur="3.2s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}

          {/* Moveable UML Stereotype Boxes */}
          {boxes.map((box) => {
            const isDragging = draggingId === box.id;
            return (
              <g
                key={box.id}
                transform={`translate(${box.x}, ${box.y})`}
                onMouseDown={(e) => handleMouseDown(e, box.id)}
                className={`cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
              >
                {/* Box Outer Card with Shadow & Border */}
                <rect
                  width={box.width}
                  height={box.height}
                  fill="#ffffff"
                  stroke={isDragging ? '#0284c7' : '#cbd5e1'}
                  strokeWidth={isDragging ? 2.5 : 1.5}
                  rx="3"
                  className="dark:fill-slate-900 dark:stroke-slate-700 shadow-lg transition-shadow"
                />

                {/* Box Stereotype Header Bar */}
                <rect
                  width={box.width}
                  height="26"
                  fill={box.headerColor}
                  stroke={isDragging ? '#0284c7' : '#cbd5e1'}
                  strokeWidth="1"
                  className="dark:fill-slate-800 dark:stroke-slate-700"
                />
                <text x="8" y="17" fill="#0f172a" fontSize="9.5" fontWeight="bold" className="dark:fill-white">
                  {box.stereotype}
                </text>
                <text x={box.width - 8} y="17" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="end" className="dark:fill-slate-400">
                  {box.badge}
                </text>

                {/* Class Title */}
                <text x="8" y="42" fill={box.textColor} fontSize="10" fontWeight="bold">
                  {box.title}
                </text>

                {/* Divider 1 */}
                <line x1="0" y1="50" x2={box.width} y2="50" stroke="#e2e8f0" strokeWidth="1" className="dark:stroke-slate-800" />

                {/* Attributes Section */}
                {box.attributes.map((attr, idx) => (
                  <text
                    key={`attr-${idx}`}
                    x="8"
                    y={63 + idx * 11}
                    fill="#475569"
                    fontSize="8"
                    className="dark:fill-slate-400"
                  >
                    {attr}
                  </text>
                ))}

                {/* Divider 2 */}
                <line
                  x1="0"
                  y1={65 + box.attributes.length * 11}
                  x2={box.width}
                  y2={65 + box.attributes.length * 11}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  className="dark:stroke-slate-800"
                />

                {/* Methods / Operations Section */}
                {box.methods.map((method, idx) => (
                  <text
                    key={`method-${idx}`}
                    x="8"
                    y={78 + box.attributes.length * 11 + idx * 12}
                    fill="#0f172a"
                    fontSize="8"
                    fontWeight={method.includes('Offline') ? 'bold' : 'normal'}
                    className={method.includes('Offline') ? 'fill-red-600 dark:fill-red-400 font-bold' : 'dark:fill-slate-200'}
                  >
                    {method}
                  </text>
                ))}

                {/* Drag Handle Icon in bottom-right */}
                <g transform={`translate(${box.width - 16}, ${box.height - 16})`} opacity="0.6">
                  <path d="M 0 10 L 10 0 M 4 10 L 10 4 M 8 10 L 10 8" stroke="#94a3b8" strokeWidth="1.5" />
                </g>
              </g>
            );
          })}

          {/* Feedback Watchdog Banner */}
          <rect
            x="360"
            y="235"
            width="560"
            height="22"
            fill="#fee2e2"
            stroke="#ef4444"
            strokeWidth="1"
            rx="2"
            className="dark:fill-red-950/90 dark:stroke-red-800"
          />
          <text x="370" y="249" fill="#b91c1c" fontSize="8.5" fontWeight="bold" className="dark:fill-red-300">
            ◄ 15s HEARTBEAT TIMEOUT: LOCKS LAST KNOWN (X,Y) &amp; RENDERS RED CIRCLE AT LAST POSITION
          </text>
        </svg>
      </div>

      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
        <span>💡 Click and drag any UML stereotype box above to re-arrange and inspect live multi-hop connector routing.</span>
        <span className="font-mono text-slate-400">5 STEREOTYPES ACTIVE // 60 FPS SVG</span>
      </div>
    </div>
  );
};

