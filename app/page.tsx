'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavbarC2 } from './components/NavbarC2';
import { HomeTab } from './components/HomeTab';
import { NodesTab } from './components/NodesTab';
import { AlertsTab } from './components/AlertsTab';
import { DataGraphsTab } from './components/DataGraphsTab';
import { SettingsTab } from './components/SettingsTab';
import { TacticalCanvas } from './components/TacticalCanvas';
import { VideoPiP } from './components/VideoPiP';
import {
  TacticalNode,
  NodeLink,
  ObstacleWall,
  GhostNode,
  JammerState,
  OperationalMode,
  TelemetryPacket,
  TabKey,
  LanguageKey,
  ThemeMode,
} from './types/tactical';
import {
  computeAdHocMeshRouting,
  computeGhostHealingWaypoints,
} from './utils/rfMath';
import {
  tacticalBlackbox,
  subscribeToFirebaseNodes,
  parseFirebaseNodes,
  firebaseConfig,
} from './utils/offlineDb';
import { Radio, Database, Wifi } from 'lucide-react';

const ANCHOR_NODE: TacticalNode = {
  id: 'TANK-00',
  callsign: 'TOC-ANCHOR',
  displayName: 'TOC-ANCHOR',
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

const SIMULATION_NODES: TacticalNode[] = [
  ANCHOR_NODE,
  {
    id: 'CMD-01',
    callsign: 'ALPHA-POINT',
    displayName: 'ALPHA-POINT',
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
    displayName: 'CHARLIE-RELAY',
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
    displayName: 'ECHO-SCOUT',
    role: 'scout_relay',
    x: 21.5,
    y: 9.5,
    battery: 78,
    activeSector: 4,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
  },
  {
    id: 'CMD-02',
    callsign: 'BRAVO-ASSAULT',
    displayName: 'BRAVO-ASSAULT',
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
    displayName: 'DELTA-MARKS',
    role: 'marksman',
    x: -9.5,
    y: -6.0,
    battery: 89,
    activeSector: 2,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
  },
];

const SIMULATION_WALLS: ObstacleWall[] = [
  {
    id: 'WALL-01',
    x1: 7.5,
    y1: -12.0,
    x2: 7.5,
    y2: 4.0,
    attenuationDb: 28.0,
    thicknessMeters: 0.35,
    material: 'reinforced_concrete',
  },
  {
    id: 'WALL-02',
    x1: 7.5,
    y1: 4.0,
    x2: 18.0,
    y2: 4.0,
    attenuationDb: 24.0,
    thicknessMeters: 0.25,
    material: 'reinforced_concrete',
  },
  {
    id: 'WALL-03',
    x1: -4.0,
    y1: -12.0,
    x2: -4.0,
    y2: 12.0,
    attenuationDb: 20.0,
    thicknessMeters: 0.2,
    material: 'brick_masonry',
  },
];

export default function TacticalDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [language, setLanguage] = useState<LanguageKey>('en');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [isPlayingSim, setIsPlayingSim] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0.0);
  const [simPhaseName, setSimPhaseName] = useState<string>('PHASE 01: NSG SAG CQB INGRESS // LINE-OF-SIGHT CLEAR');

  // Operational Mode derived from activeTab: 'simulate' runs simulation, 'dashboard' runs live
  const mode: OperationalMode = activeTab === 'simulate' ? 'simulation' : 'live';

  // Synchronize theme with root document for Tailwind dark mode
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  // 15-Second NSG Tactical CQB Simulation Animator
  useEffect(() => {
    if (!isPlayingSim || activeTab !== 'simulate') return;
    const interval = setInterval(() => {
      setSimTime((prev) => {
        const next = prev + 0.08;
        return next >= 15.0 ? 0.0 : next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [isPlayingSim, activeTab]);

  // Derive dynamic NSG tactical simulation state from 15-second timeline
  const { currentSimNodes, currentSimGhostNodes, currentSimPhase } = useMemo(() => {
    const t = simTime; // 0.0 to 15.0 seconds
    let phase = '';
    let alphaX = 3.0;
    let alphaY = 1.5;
    let alphaOffline = false;
    let lastX = 7.0;
    let lastY = 3.8;
    let ghosts: GhostNode[] = [];
    let alphaHop = 1;
    let alphaNextHop = 'TANK-00';
    let alphaSector = 3;

    if (t < 4.5) {
      // PHASE 1: INGRESS (0.0s - 4.5s)
      const progress = t / 4.5;
      alphaX = parseFloat((2.0 + progress * 5.2).toFixed(1)); // moves from 2.0 to 7.2
      alphaY = parseFloat((1.2 + progress * 2.6).toFixed(1)); // moves from 1.2 to 3.8
      alphaOffline = false;
      alphaSector = 2;
      phase = 'PHASE 01: NSG SAG CQB INGRESS // DIRECT LINE-OF-SIGHT NOMINAL (26.4 dB)';
    } else if (t < 8.5) {
      // PHASE 2: BEHIND CONCRETE WALL // SEVERED (4.5s - 8.5s)
      const progress = (t - 4.5) / 4.0;
      alphaX = parseFloat((7.8 + progress * 6.2).toFixed(1)); // moves deep to 14.0
      alphaY = parseFloat((4.2 + progress * 3.6).toFixed(1)); // moves deep to 7.8
      alphaOffline = true;
      lastX = 7.2;
      lastY = 3.8;
      alphaSector = 4;
      phase = 'PHASE 02: ⚠ NSG LINK SEVERED // 0.35m CONCRETE WALL ATTENUATION (-28dB)';
    } else if (t < 11.5) {
      // PHASE 3: DROPPING GHOST RELAY AT CORNER (8.5s - 11.5s)
      alphaX = 14.0;
      alphaY = 7.8;
      alphaOffline = true;
      lastX = 7.2;
      lastY = 3.8;
      alphaSector = 4;
      ghosts = [
        {
          targetNodeId: 'GHOST-CORNER-01',
          targetCallsign: 'GHOST-RELAY-01',
          optimalX: 8.0,
          optimalY: 4.5,
          currentX: 8.0,
          currentY: 4.5,
          shiftDistanceMeters: 0,
          shiftBearingDeg: 45,
          shiftCardinal: 'CORNER CORRIDOR (8.0, 4.5)',
          predictedSinrGainDb: 22.4,
          actionRequired: 'deploy_bridge_node',
          relayForNodeId: 'CMD-01',
        },
      ];
      phase = 'PHASE 03: ✦ OPERATIVE DROPS PULSING GREEN GHOST RELAY AT WALL CORNER (8.0, 4.5)';
    } else {
      // PHASE 4: MESH SNAPS & HEALS BOUNCING AROUND WALL (11.5s - 15.0s)
      alphaX = 14.0;
      alphaY = 7.8;
      alphaOffline = false;
      alphaHop = 2;
      alphaNextHop = 'GHOST-CORNER-01';
      alphaSector = 4;
      ghosts = [
        {
          targetNodeId: 'GHOST-CORNER-01',
          targetCallsign: 'GHOST-RELAY-01',
          optimalX: 8.0,
          optimalY: 4.5,
          currentX: 8.0,
          currentY: 4.5,
          shiftDistanceMeters: 0,
          shiftBearingDeg: 45,
          shiftCardinal: 'CORNER CORRIDOR (8.0, 4.5)',
          predictedSinrGainDb: 22.4,
          actionRequired: 'deploy_bridge_node',
          relayForNodeId: 'CMD-01',
        },
      ];
      phase = 'PHASE 04: ✓ AD-HOC MESH RESTORED // 2-HOP BOUNCE AROUND WALL (100% HEALED)';
    }

    const squadNodes: TacticalNode[] = [
      ANCHOR_NODE,
      {
        id: 'CMD-01',
        callsign: 'ALPHA-POINT',
        displayName: 'ALPHA-POINT (NSG)',
        role: 'pointman',
        x: alphaX,
        y: alphaY,
        battery: 94,
        activeSector: alphaSector,
        txPowerDbm: 20.0,
        noiseFloorDbm: -95.0,
        isOffline: alphaOffline,
        lastOnlineX: lastX,
        lastOnlineY: lastY,
        hopCount: alphaHop,
        nextHopId: alphaNextHop,
      },
      {
        id: 'CMD-02',
        callsign: 'BRAVO-ASSAULT',
        displayName: 'BRAVO-ASSAULT (NSG)',
        role: 'assault',
        x: Math.max(1.0, alphaX - 3.2),
        y: Math.max(0.5, alphaY - 1.8),
        battery: 88,
        activeSector: 2,
        txPowerDbm: 20.0,
        noiseFloorDbm: -95.0,
        hopCount: 1,
        nextHopId: 'TANK-00',
      },
      {
        id: 'CMD-03',
        callsign: 'CHARLIE-RELAY',
        displayName: 'CHARLIE-RELAY (NSG)',
        role: 'breacher',
        x: 6.8,
        y: 2.2,
        battery: 86,
        activeSector: 2,
        txPowerDbm: 20.0,
        noiseFloorDbm: -95.0,
        hopCount: 1,
        nextHopId: 'TANK-00',
      },
    ];

    return {
      currentSimNodes: squadNodes,
      currentSimGhostNodes: ghosts,
      currentSimPhase: phase,
    };
  }, [simTime]);

  const [simNodes, setSimNodes] = useState<TacticalNode[]>(SIMULATION_NODES);
  const [liveNodes, setLiveNodes] = useState<TacticalNode[]>([
    ANCHOR_NODE,
    {
      id: 'CMD-01',
      callsign: 'ALPHA-POINT',
      displayName: 'ALPHA-POINT',
      role: 'pointman',
      x: 5.2,
      y: 3.1,
      battery: 95,
      activeSector: 3,
      txPowerDbm: 20.0,
      noiseFloorDbm: -95.0,
    },
    {
      id: 'CMD-03',
      callsign: 'CHARLIE-RELAY',
      displayName: 'CHARLIE-RELAY',
      role: 'breacher',
      x: 12.8,
      y: 6.9,
      battery: 88,
      activeSector: 4,
      txPowerDbm: 20.0,
      noiseFloorDbm: -95.0,
    },
  ]);
  const [livePacketsCount, setLivePacketsCount] = useState<number>(14);

  const [walls, setWalls] = useState<ObstacleWall[]>(SIMULATION_WALLS);
  const [links, setLinks] = useState<NodeLink[]>([]);
  const [ghostNodes, setGhostNodes] = useState<GhostNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('CMD-01');
  
  const [jammer, setJammer] = useState<JammerState>({
    active: false,
    noiseModifierDb: 24,
    targetZone: 'global',
  });
  
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [systemSinrAvg, setSystemSinrAvg] = useState<number>(24.2);
  const [totalPacketsLogged, setTotalPacketsLogged] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const currentNodes = mode === 'live' ? liveNodes : (activeTab === 'simulate' ? currentSimNodes : simNodes);
  const visibleCurrentNodes = currentNodes.filter((n) => !n.isHidden);

  // Recalculate full Ad-Hoc MANET multi-hop topology, links, and ghost nodes
  const updateTopology = useCallback(
    (activeSquad: TacticalNode[], currentWalls: ObstacleWall[], currentJammer: JammerState, currentMode: OperationalMode) => {
      if (currentMode === 'simulation' && activeTab === 'simulate') {
        // In 15s NSG simulation, compute dynamic link status based on simTime
        const t = simTime;
        const simLinks: NodeLink[] = [];

        if (t < 4.5) {
          // Phase 1: TOC -> ALPHA-POINT (Direct LoS)
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'CMD-01',
            distanceMeters: 7.4,
            rssiDbm: -58,
            sinrDb: 26.4,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'CMD-02',
            distanceMeters: 4.8,
            rssiDbm: -54,
            sinrDb: 28.2,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'CMD-03',
            distanceMeters: 7.1,
            rssiDbm: -59,
            sinrDb: 25.8,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
        } else if (t < 8.5) {
          // Phase 2: Broken/Severed link through concrete wall
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'CMD-01',
            distanceMeters: 16.0,
            rssiDbm: -98,
            sinrDb: 3.2,
            status: 'broken',
            videoBitrateKbps: 0,
            isBlockedByWall: true,
            isMeshRoute: false,
          });
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'CMD-03',
            distanceMeters: 7.1,
            rssiDbm: -59,
            sinrDb: 25.8,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
        } else if (t < 11.5) {
          // Phase 3: Ghost dropped, establishing bridge
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'GHOST-CORNER-01',
            distanceMeters: 9.2,
            rssiDbm: -62,
            sinrDb: 24.8,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'CMD-03',
            distanceMeters: 7.1,
            rssiDbm: -59,
            sinrDb: 25.8,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
        } else {
          // Phase 4: Snapped 2-hop bounced link around wall
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'GHOST-CORNER-01',
            distanceMeters: 9.2,
            rssiDbm: -60,
            sinrDb: 27.2,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
          simLinks.push({
            fromId: 'GHOST-CORNER-01',
            toId: 'CMD-01',
            distanceMeters: 6.8,
            rssiDbm: -58,
            sinrDb: 28.6,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
          simLinks.push({
            fromId: 'TANK-00',
            toId: 'CMD-03',
            distanceMeters: 7.1,
            rssiDbm: -59,
            sinrDb: 25.8,
            status: 'healthy',
            videoBitrateKbps: 4500,
            isBlockedByWall: false,
            isMeshRoute: true,
          });
        }

        setLinks(simLinks);
        setGhostNodes(currentSimGhostNodes);
        return;
      }

      const effectiveWalls = currentMode === 'live' ? [] : currentWalls;
      const effectiveJammer = currentMode === 'live' ? { active: false, noiseModifierDb: 0, targetZone: 'global' as const } : currentJammer;

      // Filter out hidden nodes
      const squadToRoute = activeSquad.filter((n) => !n.isHidden);

      // Execute B.A.T.M.A.N. / OLSR multi-hop ad-hoc mesh routing
      const { updatedNodes, activeMeshLinks } = computeAdHocMeshRouting(squadToRoute, effectiveWalls, effectiveJammer);

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

  // Ingest Live Hardware Packet (with offline/disconnect support)
  const ingestLivePacket = (
    nodeId: string,
    callsign: string,
    role: TacticalNode['role'],
    x: number,
    y: number,
    battery: number,
    sector: number,
    isOffline = false
  ) => {
    setLiveNodes((prev) => {
      const exists = prev.find((n) => n.id === nodeId);
      let nextNodes: TacticalNode[];
      if (exists) {
        nextNodes = prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                x,
                y,
                battery,
                activeSector: sector,
                isOffline,
                lastOnlineX: isOffline ? (n.lastOnlineX ?? n.x) : x,
                lastOnlineY: isOffline ? (n.lastOnlineY ?? n.y) : y,
                lastOnlineTimestamp: isOffline ? Date.now() : n.lastOnlineTimestamp,
              }
            : n
        );
      } else {
        nextNodes = [
          ...prev,
          {
            id: nodeId,
            callsign,
            displayName: callsign,
            role,
            x,
            y,
            battery,
            activeSector: sector,
            txPowerDbm: 20.0,
            noiseFloorDbm: -95.0,
            isOffline,
            lastOnlineX: x,
            lastOnlineY: y,
            lastOnlineTimestamp: isOffline ? Date.now() : undefined,
          },
        ];
      }
      return nextNodes;
    });
    setLivePacketsCount((prev) => prev + 1);
    setSelectedNodeId(nodeId);
  };

  // Node Management Handlers
  const handleUpdateNodeName = (id: string, newCallsign: string) => {
    const updateFn = (list: TacticalNode[]) =>
      list.map((n) => (n.id === id ? { ...n, callsign: newCallsign, displayName: newCallsign } : n));
    if (mode === 'live') {
      setLiveNodes(updateFn);
    } else {
      setSimNodes(updateFn);
    }
  };

  const handleToggleHideNode = (id: string) => {
    const updateFn = (list: TacticalNode[]) =>
      list.map((n) => (n.id === id ? { ...n, isHidden: !n.isHidden } : n));
    if (mode === 'live') {
      setLiveNodes(updateFn);
    } else {
      setSimNodes(updateFn);
    }
  };

  const handleToggleNodeConnection = (id: string) => {
    const updateFn = (list: TacticalNode[]) =>
      list.map((n) => {
        if (n.id === id) {
          const willBeOffline = !n.isOffline;
          return {
            ...n,
            isOffline: willBeOffline,
            lastOnlineX: willBeOffline ? n.x : n.lastOnlineX,
            lastOnlineY: willBeOffline ? n.y : n.lastOnlineY,
            lastOnlineTimestamp: willBeOffline ? Date.now() : n.lastOnlineTimestamp,
          };
        }
        return n;
      });
    if (mode === 'live') {
      setLiveNodes(updateFn);
    } else {
      setSimNodes(updateFn);
    }
  };

  const handleAddNode = (newNode: TacticalNode) => {
    if (mode === 'live') {
      setLiveNodes((prev) => [...prev, newNode]);
    } else {
      setSimNodes((prev) => [...prev, newNode]);
    }
    setSelectedNodeId(newNode.id);
  };

  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);

  // Firebase Realtime Database Live Ingress
  useEffect(() => {
    if (mode === 'live') {
      const unsubscribe = subscribeToFirebaseNodes(
        (data, count) => {
          setFirebaseConnected(true);
          setLiveNodes((prevLive) => {
            const parsed = parseFirebaseNodes(data, prevLive);
            if (parsed.length === 0) return prevLive;
            // Merge with ANCHOR_NODE
            return [ANCHOR_NODE, ...parsed];
          });
          setLivePacketsCount((prev) => prev + count);
        },
        (err) => {
          console.warn('Firebase RTDB sync warning:', err);
        }
      );
      return () => unsubscribe();
    } else {
      setFirebaseConnected(false);
    }
  }, [mode]);

  // WebSocket Live Ingress (Secondary Local Feed)
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
    setSimNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              x,
              y,
              lastOnlineX: n.isOffline ? n.lastOnlineX : x,
              lastOnlineY: n.isOffline ? n.lastOnlineY : y,
            }
          : n
      )
    );
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
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden font-mono select-none flex flex-col transition-colors">
        
        {/* Top Navigation Bar with Tabs */}
        <NavbarC2
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          language={language}
          wsConnected={wsConnected}
          jammerActive={jammer.active}
          systemSinrAvg={systemSinrAvg}
          livePacketsCount={livePacketsCount}
          activeNodesCount={visibleCurrentNodes.length}
          alertsCount={currentNodes.filter((n) => !n.isAnchor && n.isOffline).length}
        />

        {/* Dynamic Tab Body */}
        <main className={`flex-1 flex flex-col ${activeTab === 'simulate' || activeTab === 'dashboard' ? 'p-1.5' : 'p-3'} gap-2 w-full max-w-[1920px] mx-auto`}>
          {/* TAB 1: HOME (Project Info, Architecture UML, Launch Dashboard) */}
          {activeTab === 'home' && (
            <HomeTab
              onLaunchDashboard={() => setActiveTab('dashboard')}
              language={language}
            />
          )}

          {/* TAB 2: LIVE DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-2 w-full">
              {/* Full-Width 2D Node-Link Tactical Canvas */}
              <div className="w-full">
                <TacticalCanvas
                  nodes={visibleCurrentNodes}
                  links={links}
                  walls={[]}
                  ghostNodes={ghostNodes}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  onUpdateNodePosition={handleUpdateNodePosition}
                  onToggleWall={handleToggleWall}
                  onResetLayout={handleResetLayout}
                  mode="live"
                  jammer={{ active: false, noiseModifierDb: 0, targetZone: 'global' }}
                  onUpdateJammer={() => {}}
                />
              </div>

              {/* Live ESP32 Firebase RTDB Stream Ingress Bar */}
              <div className="bg-white dark:bg-slate-900 border border-tactical-border dark:border-slate-800 p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                  <Database className={`w-4 h-4 ${firebaseConnected ? 'text-emerald-500 animate-pulse' : 'text-tactical-cyan'}`} />
                  <span className="font-bold">FIREBASE RTDB STREAM:</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono">
                    {firebaseConnected ? 'CONNECTED (AUTO-SYNC)' : 'STANDBY (POLLING)'}
                  </span>
                  <span className="hidden xl:inline text-[9.5px] text-slate-400 font-mono">
                    apparatus-certified-default-rtdb.asia-southeast1.firebasedatabase.app/nodes.json
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => ingestLivePacket('CMD-01', 'ALPHA-POINT', 'pointman', 5.2, 3.1, 95, 3, false)}
                    className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[9.5px] font-bold"
                  >
                    + TEST CMD-01 (ONLINE)
                  </button>
                  <button
                    onClick={() => ingestLivePacket('CMD-03', 'CHARLIE-RELAY', 'breacher', 12.8, 6.9, 88, 4, false)}
                    className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[9.5px] font-bold"
                  >
                    + TEST CMD-03 (ONLINE)
                  </button>
                  <button
                    onClick={() => ingestLivePacket('CMD-05', 'ECHO-SCOUT', 'scout_relay', 20.4, 8.7, 82, 4, true)}
                    className="px-2 py-1 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-[9.5px] font-bold"
                  >
                    + TEST CMD-05 (OFFLINE RED)
                  </button>
                  <button
                    onClick={() => handleToggleNodeConnection('CMD-05')}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white text-[9.5px] font-bold"
                  >
                    TOGGLE CMD-05
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIMULATE (Interactive Simulation Sandbox with Obstacles, Drag-Drop, Jammer) */}
          {activeTab === 'simulate' && (
            <div className="flex flex-col gap-2 w-full">
              {/* Full-Width 2D Node-Link Tactical Simulation Canvas */}
              <div className="w-full">
                <TacticalCanvas
                  nodes={visibleCurrentNodes}
                  links={links}
                  walls={walls}
                  ghostNodes={ghostNodes}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  onUpdateNodePosition={handleUpdateNodePosition}
                  onToggleWall={handleToggleWall}
                  onResetLayout={handleResetLayout}
                  mode="simulation"
                  jammer={jammer}
                  onUpdateJammer={setJammer}
                  isPlayingSim={isPlayingSim}
                  onTogglePlaySim={() => setIsPlayingSim((prev) => !prev)}
                  simTime={simTime}
                  simPhaseName={currentSimPhase}
                  onSeekSimTime={setSimTime}
                />
              </div>
            </div>
          )}

          {/* TAB 4: NODES (Cards view, Edit Display Name, Delete/Hide, Reconnect/Disconnect) */}
          {activeTab === 'nodes' && (
            <NodesTab
              nodes={currentNodes}
              links={links}
              ghostNodes={ghostNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onUpdateNodeName={handleUpdateNodeName}
              onToggleHideNode={handleToggleHideNode}
              onToggleNodeConnection={handleToggleNodeConnection}
              onAddNode={handleAddNode}
              language={language}
            />
          )}

          {/* TAB 5: ALERTS (Incident reporting, 2+ node spatial clustering, and Ghost Node suggestions) */}
          {activeTab === 'alerts' && (
            <AlertsTab
              nodes={currentNodes}
              ghostNodes={ghostNodes}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setActiveTab('dashboard');
              }}
              onJumpToDashboard={() => setActiveTab('dashboard')}
              onJumpToSimulate={() => setActiveTab('simulate')}
              language={language}
            />
          )}

          {/* TAB 6: DATA & GRAPHS (Placeholder) */}
          {activeTab === 'data-graphs' && <DataGraphsTab language={language} />}

          {/* TAB 7: SETTINGS (Dark Mode, Language, RF Config) */}
          {activeTab === 'settings' && (
            <SettingsTab
              theme={theme}
              setTheme={setTheme}
              language={language}
              setLanguage={setLanguage}
            />
          )}
        </main>

        {/* Floating Draggable Picture-in-Picture L-Band Tactical Video Feed */}
        {(activeTab === 'dashboard' || activeTab === 'simulate') && (
          <VideoPiP
            nodes={visibleCurrentNodes}
            links={links}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            mode={mode}
          />
        )}
      </div>
    </div>
  );
}


