'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HeaderC2 } from './components/HeaderC2';
import { TacticalCanvas } from './components/TacticalCanvas';
import { TelemetryTable } from './components/TelemetryTable';
import { VideoPiP } from './components/VideoPiP';
import { MissionReplay } from './components/MissionReplay';
import { DataFlowDiagram } from './components/DataFlowDiagram';
import {
  TacticalNode,
  NodeLink,
  ObstacleWall,
  GhostNode,
  JammerState,
  OperationalMode,
  TelemetryPacket,
} from './types/tactical';
import {
  computeAdHocMeshRouting,
  computeGhostHealingWaypoints,
} from './utils/rfMath';
import { tacticalBlackbox } from './utils/offlineDb';
import { Radio } from 'lucide-react';

const ANCHOR_NODE: TacticalNode = {
  id: 'TANK-00',
  callsign: 'TOC-ANCHOR',
  role: 'anchor',
  x: 0.0,
  y: 0.0,
  battery: 100,
  activeSector: 1,
  txPowerDbm: 30.0,
  noiseFloorDbm: -95.0,
  isAnchor: true,
  hopCount: 0,
  nextHopId: 'ROOT',
  routePath: ['TANK-00'],
};

// Tactical Node Preset: CMD-01 is near Tank, CMD-03 is mid-relay, CMD-05 is beyond to the right of CMD-03
const SIMULATION_NODES: TacticalNode[] = [
  ANCHOR_NODE,
  {
    id: 'CMD-01',
    callsign: 'ALPHA-POINT',
    role: 'pointman',
    x: 4.5,
    y: 2.5,
    battery: 94,
    activeSector: 3,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
  },
  {
    id: 'CMD-03',
    callsign: 'CHARLIE-RELAY',
    role: 'breacher',
    x: 13.5,
    y: 7.5,
    battery: 86,
    activeSector: 4,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
  },
  {
    id: 'CMD-05',
    callsign: 'ECHO-SCOUT',
    role: 'scout_relay',
    x: 21.5,
    y: 9.5, // Placed beyond to the right of CMD-03 (Ad-hoc 3-hop chain: C05 -> C03 -> C01 -> TANK)
    battery: 78,
    activeSector: 4,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
  },
  {
    id: 'CMD-02',
    callsign: 'BRAVO-ASSAULT',
    role: 'assault',
    x: 16.5,
    y: -9.0,
    battery: 81,
    activeSector: 4,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
  },
  {
    id: 'CMD-04',
    callsign: 'DELTA-MARKS',
    role: 'marksman',
    x: -9.5,
    y: -6.0,
    battery: 89,
    activeSector: 2,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
  },
];

// Concrete obstacle barrier
const SIMULATION_WALLS: ObstacleWall[] = [
  {
    id: 'WALL-01',
    x1: 7.5,
    y1: -14.0,
    x2: 7.5,
    y2: 4.0,
    attenuationDb: 28.0,
    thicknessMeters: 0.35,
    material: 'reinforced_concrete',
  },
];

export default function TacticalDashboardPage() {
  const [mode, setMode] = useState<OperationalMode>('simulation');
  
  const [simNodes, setSimNodes] = useState<TacticalNode[]>(SIMULATION_NODES);
  const [liveNodes, setLiveNodes] = useState<TacticalNode[]>([ANCHOR_NODE]);
  const [livePacketsCount, setLivePacketsCount] = useState<number>(0);

  const [walls, setWalls] = useState<ObstacleWall[]>(SIMULATION_WALLS);
  const [links, setLinks] = useState<NodeLink[]>([]);
  const [ghostNodes, setGhostNodes] = useState<GhostNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('CMD-05');
  
  const [jammer, setJammer] = useState<JammerState>({
    active: false,
    noiseModifierDb: 24,
    targetZone: 'global',
  });
  
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [systemSinrAvg, setSystemSinrAvg] = useState<number>(22.4);
  const [totalPacketsLogged, setTotalPacketsLogged] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const currentNodes = mode === 'live' ? liveNodes : simNodes;

  // Recalculate full Ad-Hoc MANET multi-hop topology, links, and ghost nodes
  const updateTopology = useCallback(
    (activeSquad: TacticalNode[], currentWalls: ObstacleWall[], currentJammer: JammerState, currentMode: OperationalMode) => {
      const effectiveWalls = currentMode === 'live' ? [] : currentWalls;
      const effectiveJammer = currentMode === 'live' ? { active: false, noiseModifierDb: 0, targetZone: 'global' as const } : currentJammer;

      // Execute B.A.T.M.A.N. / OLSR multi-hop ad-hoc mesh routing
      const { updatedNodes, activeMeshLinks } = computeAdHocMeshRouting(activeSquad, effectiveWalls, effectiveJammer);

      // Ad-Hoc Network Healing: Compute Ghost Nodes along the multi-hop chain
      const calculatedGhostNodes = computeGhostHealingWaypoints(
        updatedNodes,
        effectiveWalls,
        effectiveJammer
      );

      let totalSinr = 0;
      let sinrCount = 0;
      activeMeshLinks.forEach((l) => {
        totalSinr += l.sinrDb;
        sinrCount++;
      });

      setLinks(activeMeshLinks);
      setGhostNodes(calculatedGhostNodes);
      const meanSinr = sinrCount > 0 ? totalSinr / sinrCount : 24.0;
      setSystemSinrAvg(parseFloat(meanSinr.toFixed(1)));

      const packet: TelemetryPacket = {
        timestamp: Date.now(),
        nodes: updatedNodes,
        links: activeMeshLinks,
        ghostNodes: calculatedGhostNodes,
        jammer: effectiveJammer,
        systemSinrAvg: meanSinr,
        packetLossPct: meanSinr < 8 ? 42.5 : meanSinr < 14 ? 12.0 : 0.2,
        meshHopsAvg: calculatedGhostNodes.length > 0 ? 2 : 1,
      };

      tacticalBlackbox.logPacket(packet).then(() => {
        setTotalPacketsLogged((prev) => prev + 1);
      });
    },
    []
  );

  useEffect(() => {
    updateTopology(currentNodes, walls, jammer, mode);
  }, [currentNodes, walls, jammer, mode, updateTopology]);

  // Ingest Live Hardware Packet
  const ingestLivePacket = (nodeId: string, callsign: string, role: TacticalNode['role'], x: number, y: number, battery: number, sector: number) => {
    setLiveNodes((prev) => {
      const exists = prev.find((n) => n.id === nodeId);
      let nextNodes: TacticalNode[];
      if (exists) {
        nextNodes = prev.map((n) =>
          n.id === nodeId ? { ...n, x, y, battery, activeSector: sector } : n
        );
      } else {
        nextNodes = [
          ...prev,
          {
            id: nodeId,
            callsign,
            role,
            x,
            y,
            battery,
            activeSector: sector,
            txPowerDbm: 20.0,
            noiseFloorDbm: -95.0,
          },
        ];
      }
      return nextNodes;
    });
    setLivePacketsCount((prev) => prev + 1);
    setSelectedNodeId(nodeId);
  };

  // WebSocket Live Ingress
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | undefined;

    if (mode === 'live') {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => setWsConnected(true);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'node_telemetry_update' && data.payload) {
              const { node_id, role, metrics, coords } = data.payload;
              ingestLivePacket(
                node_id,
                `CMD-${node_id.replace('CMD-', '')}`,
                role || 'assault',
                coords?.x ?? 8.0,
                coords?.y ?? 6.0,
                metrics?.battery_pct ?? 85,
                metrics?.active_sector ?? 1
              );
            }
          } catch (e) {
            console.error('WS parsing error:', e);
          }
        };
        ws.onerror = () => setWsConnected(false);
        ws.onclose = () => {
          setWsConnected(false);
        };
        wsRef.current = ws;
      } catch (e) {
        setWsConnected(false);
      }
    } else {
      setWsConnected(false);
      if (wsRef.current) wsRef.current.close();
    }

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [mode]);

  // Update Node position via 2D Canvas Drag-and-Drop (Instant state update without snapback)
  const handleUpdateNodePosition = (id: string, x: number, y: number) => {
    if (mode === 'live') return;
    setSimNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  };

  // Toggle or remove a wall obstacle
  const handleToggleWall = (wallId: string) => {
    if (mode === 'live') return;
    setWalls((prev) => prev.filter((w) => w.id !== wallId));
  };

  // Reset tactical squad to default baseline
  const handleResetLayout = () => {
    setSimNodes(SIMULATION_NODES);
    setWalls(SIMULATION_WALLS);
    setJammer({ active: false, noiseModifierDb: 24, targetZone: 'global' });
  };

  return (
    <div className="min-h-screen w-full bg-tactical-bg text-slate-900 overflow-x-hidden font-mono select-none flex flex-col">
      {/* Topbar */}
      <HeaderC2
        mode={mode}
        setMode={setMode}
        wsConnected={wsConnected}
        jammerActive={jammer.active}
        systemSinrAvg={systemSinrAvg}
        totalPacketsLogged={totalPacketsLogged}
        livePacketsCount={livePacketsCount}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col p-3 gap-3 w-full max-w-[1920px] mx-auto">
        {/* 1. Full-Width 2D Node-Link Tactical Canvas */}
        <div className="w-full">
          <TacticalCanvas
            nodes={currentNodes}
            links={links}
            walls={walls}
            ghostNodes={ghostNodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onUpdateNodePosition={handleUpdateNodePosition}
            onToggleWall={handleToggleWall}
            onResetLayout={handleResetLayout}
            mode={mode}
            jammer={jammer}
            onUpdateJammer={setJammer}
          />
        </div>

        {/* Live HW Test Ingress Bar (Live Mode Only) */}
        {mode === 'live' && (
          <div className="bg-white border border-tactical-border p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Radio className="w-4 h-4 text-tactical-cyan animate-pulse" />
              <span>LIVE ESP32 HW TELEMETRY PACKET INGRESS (MANUAL STREAM INJECTOR):</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => ingestLivePacket('CMD-01', 'ALPHA-POINT', 'pointman', 4.5, 3.2, 92, 3)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[10px] font-bold"
              >
                + INGEST CMD-01
              </button>
              <button
                onClick={() => ingestLivePacket('CMD-03', 'CHARLIE-RELAY', 'breacher', 13.5, 7.5, 86, 4)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[10px] font-bold"
              >
                + INGEST CMD-03
              </button>
              <button
                onClick={() => ingestLivePacket('CMD-05', 'ECHO-SCOUT', 'scout_relay', 21.5, 9.5, 78, 4)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[10px] font-bold"
              >
                + INGEST CMD-05
              </button>
            </div>
          </div>
        )}

        {/* 2. Raw SIGINT & Telemetry Stream (Full Width Table Below Map with Multi-Hop MANET Routing) */}
        <div className="w-full h-64 flex-shrink-0">
          <TelemetryTable
            nodes={currentNodes}
            links={links}
            ghostNodes={ghostNodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            mode={mode}
          />
        </div>

        {/* 3. System Architecture & Data Flow UML Diagram */}
        <div className="w-full">
          <DataFlowDiagram />
        </div>

        {/* 4. Mission Blackbox Logging Footer */}
        <div className="w-full">
          <MissionReplay
            currentPacketCount={totalPacketsLogged}
            onRefreshCount={() => setTotalPacketsLogged(0)}
          />
        </div>
      </main>

      {/* Floating Draggable Picture-in-Picture L-Band Tactical Video Feed */}
      <VideoPiP
        nodes={currentNodes}
        links={links}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        mode={mode}
      />
    </div>
  );
}
