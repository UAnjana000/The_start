'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  id: 'Gateway',
  callsign: 'Gateway',
  displayName: 'GATEWAY [BASE]',
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
  routePath: ['Gateway'],
  deviceId: 'ESP32-S',
  lat: 28.61390,
  lon: 77.20900,
  movementSpeedMs: 0.0,
  rssiDbm: 0.0,
  sinrDb: 40.0,
  pdrPct: 100.0,
};

const SIMULATION_NODES: TacticalNode[] = [
  ANCHOR_NODE,
  {
    id: 'Node 1',
    callsign: 'Node 1',
    displayName: 'Node 1 [1H➔Gateway]',
    role: 'pointman',
    x: -8.0,
    y: 3.5,
    battery: 94,
    activeSector: 2,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
    hopCount: 1,
    nextHopId: 'Gateway',
    routePath: ['Node 1', 'Gateway'],
    deviceId: 'ESP32-S',
    lat: 28.61395,
    lon: 77.20910,
    movementSpeedMs: 0.8,
    rssiDbm: -62.0,
    sinrDb: 32.0,
    pdrPct: 99.4,
    isOffline: false,
  },
  {
    id: 'Node 2',
    callsign: 'Node 2',
    displayName: 'Node 2 [OFFLINE // WALL OCCLUSION]',
    role: 'assault',
    x: 12.0,
    y: -5.0,
    battery: 82,
    activeSector: 1,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
    isOffline: true,
    lastOnlineX: 12.0,
    lastOnlineY: -5.0,
    lastOnlineTimestamp: Date.now(),
    hopCount: 99,
    nextHopId: 'OFFLINE',
    routePath: ['Node 2'],
    deviceId: 'ESP32-S',
    lat: 28.61425,
    lon: 77.20950,
    movementSpeedMs: 0.0,
    rssiDbm: -88.0,
    sinrDb: 0.0,
    pdrPct: 0.0,
    mlRiskScore: 88,
    mlWarning: '⚠️ IMPENDING LINK FAILURE // WALL OCCLUSION: Move 1.5m East to restore Line-of-Sight with Gateway/Node 1.',
  },
  {
    id: 'Node 3',
    callsign: 'Node 3',
    displayName: 'Node 3 [2H➔Node 1]',
    role: 'marksman',
    x: 6.0,
    y: 5.5,
    battery: 88,
    activeSector: 4,
    txPowerDbm: 20.0,
    noiseFloorDbm: -95.0,
    hopCount: 2,
    nextHopId: 'Node 1',
    routePath: ['Node 3', 'Node 1', 'Gateway'],
    deviceId: 'ESP32-S',
    lat: 28.61412,
    lon: 77.20935,
    movementSpeedMs: 1.1,
    rssiDbm: -66.0,
    sinrDb: 29.0,
    pdrPct: 98.6,
    isOffline: false,
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

  // NSG Tactical CQB Simulation Animator - Smooth 35ms tick rate
  useEffect(() => {
    if (!isPlayingSim || activeTab !== 'simulate') return;
    const interval = setInterval(() => {
      setSimTime((prev) => {
        const next = prev + 0.035;
        return next >= 15.0 ? 0.0 : next;
      });
    }, 35);
    return () => clearInterval(interval);
  }, [isPlayingSim, activeTab]);

  // Derive dynamic tactical simulation state from 15-second timeline (3 Nodes: Node 1 & 3 Active, Node 2 Offline + Gateway)
  const { currentSimNodes, currentSimGhostNodes, currentSimPhase, currentSimLinks } = useMemo(() => {
    const t = simTime; // 0.0 to 15.0 seconds
    let phase = '';
    let node1X = -8.0;
    let node1Y = 3.5;
    let node2X = 12.0;
    let node2Y = -5.0;
    let node3X = 6.0;
    let node3Y = 5.5;
    const ghosts: GhostNode[] = [];
    const simLinks: NodeLink[] = [];

    if (t < 5.0) {
      // KEYFRAME 01: DIRECT WALL OCCLUSION (0.0s - 5.0s)
      node1X = -8.0;
      node1Y = 3.5;
      node2X = 12.0;
      node2Y = -5.0;
      node3X = 6.0;
      node3Y = 5.5;
      phase = 'KEYFRAME 01: DIRECT WALL OCCLUSION // NODE 2 OFFLINE BEHIND CONCRETE OBSTACLE';

      simLinks.push({
        fromId: 'Node 1',
        toId: 'Gateway',
        distanceMeters: 8.7,
        rssiDbm: -62.0,
        sinrDb: 32.0,
        status: 'healthy',
        videoBitrateKbps: 5000,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
      simLinks.push({
        fromId: 'Node 3',
        toId: 'Node 1',
        distanceMeters: 14.1,
        rssiDbm: -66.0,
        sinrDb: 29.0,
        status: 'healthy',
        videoBitrateKbps: 4800,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
      simLinks.push({
        fromId: 'Gateway',
        toId: 'Node 2',
        distanceMeters: 13.0,
        rssiDbm: -88.0,
        sinrDb: 0.0,
        status: 'broken',
        videoBitrateKbps: 0,
        isBlockedByWall: true,
        isMeshRoute: false,
      });

      ghosts.push({
        targetNodeId: 'Node 2',
        targetCallsign: 'Node 2',
        optimalX: 6.0,
        optimalY: -2.5,
        currentX: 12.0,
        currentY: -5.0,
        shiftDistanceMeters: 6.7,
        shiftBearingDeg: 155,
        shiftCardinal: '1.5m East',
        predictedSinrGainDb: 28.0,
        actionRequired: 'reposition_relay',
      });
    } else if (t < 7.5) {
      // NODE 3 ADVANCES TO UPPER CORRIDOR (5.0s - 7.5s)
      const progress = (t - 5.0) / 2.5;
      node1X = -8.0;
      node1Y = 3.5;
      node2X = 12.0;
      node2Y = -5.0;
      node3X = 6.0 + progress * 2.5; // 6.0 -> 8.5
      node3Y = 5.5 + progress * 1.5; // 5.5 -> 7.0
      phase = '02: NODE 3 ADVANCING ALONG CORRIDOR // NODE 1 HOLDING RELAY TO GATEWAY';

      simLinks.push({
        fromId: 'Node 1',
        toId: 'Gateway',
        distanceMeters: 8.7,
        rssiDbm: -62.0,
        sinrDb: 32.0,
        status: 'healthy',
        videoBitrateKbps: 5000,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
      simLinks.push({
        fromId: 'Node 3',
        toId: 'Node 1',
        distanceMeters: 16.8,
        rssiDbm: -68.0,
        sinrDb: 27.0,
        status: 'healthy',
        videoBitrateKbps: 4500,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
      simLinks.push({
        fromId: 'Gateway',
        toId: 'Node 2',
        distanceMeters: 13.0,
        rssiDbm: -88.0,
        sinrDb: 0.0,
        status: 'broken',
        videoBitrateKbps: 0,
        isBlockedByWall: true,
        isMeshRoute: false,
      });

      ghosts.push({
        targetNodeId: 'Node 2',
        targetCallsign: 'Node 2',
        optimalX: 6.0,
        optimalY: -2.5,
        currentX: 12.0,
        currentY: -5.0,
        shiftDistanceMeters: 6.7,
        shiftBearingDeg: 155,
        shiftCardinal: '1.5m East',
        predictedSinrGainDb: 28.0,
        actionRequired: 'reposition_relay',
      });
    } else if (t < 10.5) {
      // NODE 1 ADVANCES FORWARD TO BRIDGE OBSTACLE (8.5s - 10.5s)
      const progress = (t - 7.5) / 3.0;
      node1X = -8.0 + progress * 4.0; // -8.0 -> -4.0
      node1Y = 3.5 + progress * 2.0;  // 3.5 -> 5.5
      node2X = 12.0;
      node2Y = -5.0;
      node3X = 8.5;
      node3Y = 7.0;
      phase = 'ML EARLY WARNING LAYER ACTIVE // PREDICTIVE REPOSITIONING ADVISORY';

      simLinks.push({
        fromId: 'Node 1',
        toId: 'Gateway',
        distanceMeters: 6.8,
        rssiDbm: -58.0,
        sinrDb: 34.0,
        status: 'healthy',
        videoBitrateKbps: 5000,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
      simLinks.push({
        fromId: 'Node 3',
        toId: 'Node 1',
        distanceMeters: 12.6,
        rssiDbm: -64.0,
        sinrDb: 30.0,
        status: 'healthy',
        videoBitrateKbps: 5000,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
      simLinks.push({
        fromId: 'Gateway',
        toId: 'Node 2',
        distanceMeters: 13.0,
        rssiDbm: -88.0,
        sinrDb: 0.0,
        status: 'broken',
        videoBitrateKbps: 0,
        isBlockedByWall: true,
        isMeshRoute: false,
      });

      ghosts.push({
        targetNodeId: 'Node 2',
        targetCallsign: 'Node 2',
        optimalX: 6.0,
        optimalY: -2.5,
        currentX: 12.0,
        currentY: -5.0,
        shiftDistanceMeters: 6.7,
        shiftBearingDeg: 155,
        shiftCardinal: '1.5m East',
        predictedSinrGainDb: 28.0,
        actionRequired: 'reposition_relay',
      });
    } else {
      // KEYFRAME 03: AD-HOC MESH FULLY RESTORED (10.5s - 15.0s)
      node1X = -4.0;
      node1Y = 5.5;
      node2X = 12.0;
      node2Y = -5.0;
      node3X = 8.5;
      node3Y = 7.0;
      phase = 'KEYFRAME 03: AD-HOC MESH FULLY RESTORED // NODE 2 RECONNECTED VIA RELAY (100% HEALED)';

      simLinks.push({
        fromId: 'Node 1',
        toId: 'Gateway',
        distanceMeters: 6.8,
        rssiDbm: -58.0,
        sinrDb: 34.0,
        status: 'healthy',
        videoBitrateKbps: 5000,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
      simLinks.push({
        fromId: 'Node 3',
        toId: 'Node 1',
        distanceMeters: 12.6,
        rssiDbm: -64.0,
        sinrDb: 30.0,
        status: 'healthy',
        videoBitrateKbps: 5000,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
      simLinks.push({
        fromId: 'Node 2',
        toId: 'Node 3',
        distanceMeters: 12.5,
        rssiDbm: -64.0,
        sinrDb: 28.0,
        status: 'healthy',
        videoBitrateKbps: 4800,
        isBlockedByWall: false,
        isMeshRoute: true,
      });
    }

    const squadNodes: TacticalNode[] = [
      ANCHOR_NODE,
      {
        id: 'Node 1',
        callsign: 'Node 1',
        displayName: 'Node 1 [1H➔Gateway]',
        role: 'pointman',
        x: node1X,
        y: node1Y,
        battery: 94,
        activeSector: 2,
        txPowerDbm: 20.0,
        noiseFloorDbm: -95.0,
        hopCount: 1,
        nextHopId: 'Gateway',
        routePath: ['Node 1', 'Gateway'],
        deviceId: 'ESP32-S',
        lat: parseFloat((28.61395 + (node1Y * 0.00001)).toFixed(5)),
        lon: parseFloat((77.20910 + (node1X * 0.00001)).toFixed(5)),
        movementSpeedMs: t >= 7.5 && t < 10.5 ? 1.2 : 0.0,
        rssiDbm: -62.0,
        sinrDb: 32.0,
        pdrPct: 99.4,
        isOffline: false,
      },
      {
        id: 'Node 2',
        callsign: 'Node 2',
        displayName: t >= 10.5 ? 'Node 2 [2H➔Node 3]' : 'Node 2 [OFFLINE // WALL OCCLUSION]',
        role: 'assault',
        x: node2X,
        y: node2Y,
        battery: 82,
        activeSector: t >= 10.5 ? 4 : (Math.floor(t * 2) % 4 + 1),
        txPowerDbm: 20.0,
        noiseFloorDbm: -95.0,
        isOffline: t < 10.5,
        lastOnlineX: 12.0,
        lastOnlineY: -5.0,
        lastOnlineTimestamp: Date.now(),
        hopCount: t >= 10.5 ? 2 : 99,
        nextHopId: t >= 10.5 ? 'Node 3' : 'OFFLINE',
        routePath: t >= 10.5 ? ['Node 2', 'Node 3', 'Node 1', 'Gateway'] : ['Node 2'],
        deviceId: 'ESP32-S',
        lat: 28.61425,
        lon: 77.20950,
        movementSpeedMs: 0.0,
        rssiDbm: t >= 10.5 ? -64.0 : -88.0,
        sinrDb: t >= 10.5 ? 28.0 : 0.0,
        pdrPct: t >= 10.5 ? 98.5 : 0.0,
        mlRiskScore: t >= 10.5 ? 12 : 88,
        mlWarning: t < 10.5 ? '⚠️ IMPENDING LINK FAILURE // WALL OCCLUSION: Move 1.5m East to restore Line-of-Sight with Gateway/Node 1.' : undefined,
      },
      {
        id: 'Node 3',
        callsign: 'Node 3',
        displayName: 'Node 3 [2H➔Node 1]',
        role: 'marksman',
        x: node3X,
        y: node3Y,
        battery: 88,
        activeSector: 4,
        txPowerDbm: 20.0,
        noiseFloorDbm: -95.0,
        hopCount: 2,
        nextHopId: 'Node 1',
        routePath: ['Node 3', 'Node 1', 'Gateway'],
        deviceId: 'ESP32-S',
        lat: parseFloat((28.61412 + (node3Y * 0.00001)).toFixed(5)),
        lon: parseFloat((77.20935 + (node3X * 0.00001)).toFixed(5)),
        movementSpeedMs: t >= 5.0 && t < 7.5 ? 1.4 : 0.0,
        rssiDbm: -66.0,
        sinrDb: 29.0,
        pdrPct: 98.6,
        isOffline: false,
      },
    ];

    return {
      currentSimNodes: squadNodes,
      currentSimGhostNodes: ghosts,
      currentSimPhase: phase,
      currentSimLinks: simLinks,
    };
  }, [simTime]);

  const [simNodes, setSimNodes] = useState<TacticalNode[]>(SIMULATION_NODES);
  const [liveNodes, setLiveNodes] = useState<TacticalNode[]>(SIMULATION_NODES);
  const [livePacketsCount, setLivePacketsCount] = useState<number>(14);

  const [walls, setWalls] = useState<ObstacleWall[]>(SIMULATION_WALLS);
  const [links, setLinks] = useState<NodeLink[]>([]);
  const [ghostNodes, setGhostNodes] = useState<GhostNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('Node 1');
  
  const [jammer, setJammer] = useState<JammerState>({
    active: false,
    noiseModifierDb: 24,
    targetZone: 'global',
  });
  
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [systemSinrAvg, setSystemSinrAvg] = useState<number>(24.2);
  const [totalPacketsLogged, setTotalPacketsLogged] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const currentNodes = mode === 'live'
    ? liveNodes
    : (activeTab === 'simulate' && isPlayingSim ? currentSimNodes : simNodes);
  const visibleCurrentNodes = currentNodes.filter((n) => !n.isHidden);

  const currentLinks = mode === 'live'
    ? links
    : (activeTab === 'simulate' && isPlayingSim ? currentSimLinks : links);
  const currentGhostNodes = mode === 'live'
    ? ghostNodes
    : (activeTab === 'simulate' && isPlayingSim ? currentSimGhostNodes : ghostNodes);

  // Recalculate full Ad-Hoc MANET multi-hop topology, links, and ghost nodes for Live/Manual Sandbox
  const updateTopology = useCallback(
    (activeSquad: TacticalNode[], currentWalls: ObstacleWall[], currentJammer: JammerState, currentMode: OperationalMode) => {
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

  // Synchronize simNodes with currentSimNodes whenever simTime changes during playback or seeking
  useEffect(() => {
    if (activeTab === 'simulate') {
      setSimNodes(currentSimNodes);
    }
  }, [simTime, activeTab]);

  // When simulation is OFF (!isPlayingSim), recalculate ad-hoc mesh routing whenever user moves nodes
  useEffect(() => {
    if (activeTab === 'simulate' && !isPlayingSim) {
      updateTopology(simNodes, walls, jammer, 'simulation');
    }
  }, [simNodes, walls, jammer, activeTab, isPlayingSim, updateTopology]);

  useEffect(() => {
    if (mode === 'live') {
      updateTopology(currentNodes, walls, jammer, mode);
    }
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
          activeNodesCount={(isPlayingSim ? currentSimNodes : liveNodes).filter((n) => !n.isHidden).length}
          alertsCount={(isPlayingSim ? currentSimNodes : liveNodes).filter((n) => !n.isAnchor && n.isOffline).length}
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
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ACTIVE SINK // LISTENING ON 2.4GHz
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIMULATE (Interactive Simulation Sandbox with Obstacles, Drag-Drop, Jammer) */}
          {activeTab === 'simulate' && (
            <div className="flex flex-col gap-3 w-full pb-8">
              {/* Full-Width 2D Node-Link Tactical Simulation Canvas */}
              <div className="w-full">
                <TacticalCanvas
                  nodes={visibleCurrentNodes}
                  links={currentLinks}
                  walls={walls}
                  ghostNodes={currentGhostNodes}
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

              {/* 3 Core Tactical Flow Cards - Exact Match to Keyframe Images */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col gap-1.5 shadow-sm font-mono">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold uppercase">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>01. KEYFRAME 1: WALL OCCLUSION (0s - 5s)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                    <strong>TOC-ANCHOR</strong> has direct links to <strong>CMD-06</strong> (-26 dBm) & <strong>BRAVO</strong> (-33 dBm). Vertical wall severs direct LoS to <strong>ALPHA-POINT</strong> & <strong>CHARLIE-CORNER</strong> (<span className="text-red-500 font-semibold font-mono">🔴 Red Dashed BLOCKED (-56 dBm)</span>).
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col gap-1.5 shadow-sm font-mono">
                  <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span>02. KEYFRAME 2: FLANK RELAY (5s - 10s)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                    <strong>CMD-06</strong> advances to (-26, -1) relaying via <strong>BRAVO-SUPPORT</strong> (-30 dBm). <strong>C04 (DELTA-SCOUT)</strong> then moves up Corridor 01 to bypass the wall before Keyframe 3 ad-hoc mesh activates.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col gap-1.5 shadow-sm font-mono">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>03. KEYFRAME 3: AD-HOC RESTORED (10s - 15s)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                    Full ad-hoc loop routes around obstacles: <strong>TOC</strong> ➔ <strong>DELTA</strong> (-14 dBm) ➔ <strong>CMD-05</strong> (-44 dBm, over wall) ➔ <strong>CHARLIE</strong> (-38 dBm) ➔ <strong>ALPHA</strong> (-28 dBm). All links <span className="text-emerald-500 font-semibold font-mono">🟢 100% Green</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NODES (Cards view, Edit Display Name, Delete/Hide, Reconnect/Disconnect) */}
          {activeTab === 'nodes' && (
            <NodesTab
              nodes={isPlayingSim ? currentSimNodes : liveNodes}
              links={isPlayingSim ? currentSimLinks : links}
              ghostNodes={isPlayingSim ? currentSimGhostNodes : ghostNodes}
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
              nodes={isPlayingSim ? currentSimNodes : liveNodes}
              ghostNodes={isPlayingSim ? currentSimGhostNodes : ghostNodes}
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


