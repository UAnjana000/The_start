export type NodeRole = 'anchor' | 'pointman' | 'assault' | 'breacher' | 'marksman' | 'scout_relay' | 'uav_relay';
export type LinkStatus = 'healthy' | 'degraded' | 'critical' | 'broken';

export interface TacticalNode {
  id: string;
  callsign: string;
  displayName?: string;
  role: NodeRole;
  x: number; // relative coordinate in meters (TANK-00 is at 0,0)
  y: number;
  battery: number; // percentage (0 - 100)
  activeSector: number; // 1, 2, 3, 4 (smart beamforming conformal array)
  txPowerDbm: number;
  noiseFloorDbm: number;
  isAnchor?: boolean;
  videoActive?: boolean;
  hopCount?: number; // Multi-hop MANET hop count to TANK-00
  nextHopId?: string; // Direct upstream mesh relay
  routePath?: string[]; // Full breadcrumb chain (e.g. ["CMD-05", "CMD-03", "CMD-01", "TANK-00"])
  bottleneckSinrDb?: number;
  isOffline?: boolean; // True when node loses connection
  lastOnlineX?: number; // Last known coordinates before connection loss
  lastOnlineY?: number;
  lastOnlineTimestamp?: number;
  isHidden?: boolean; // When deleted/hidden from primary view
}

export interface NodeLink {
  fromId: string;
  toId: string;
  distanceMeters: number;
  rssiDbm: number;
  sinrDb: number;
  status: LinkStatus;
  videoBitrateKbps: number; // Dynamic QoS rate
  isBlockedByWall: boolean;
  isMeshRoute?: boolean; // Is this an active multi-hop routing tree edge
}

export interface ObstacleWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  attenuationDb: number; // e.g. 20-35 dB for reinforced concrete
  thicknessMeters: number;
  material: 'reinforced_concrete' | 'brick_masonry' | 'steel_door';
}

export interface GhostNode {
  targetNodeId: string;
  targetCallsign: string;
  optimalX: number;
  optimalY: number;
  currentX: number;
  currentY: number;
  shiftDistanceMeters: number;
  shiftBearingDeg: number;
  shiftCardinal: string; // e.g. "5.2m NNE"
  predictedSinrGainDb: number;
  actionRequired: 'reposition_relay' | 'deploy_bridge_node';
  relayForNodeId?: string; // Which downstream node is healed
}

export interface JammerState {
  active: boolean;
  noiseModifierDb: number; // 0 to 40 dB
  targetZone: 'global' | 'sector_north' | 'sector_south' | 'deep_basement';
  centerCoords?: { x: number; y: number };
  radiusMeters?: number;
}

export interface TelemetryPacket {
  timestamp: number;
  nodes: TacticalNode[];
  links: NodeLink[];
  ghostNodes: GhostNode[];
  jammer: JammerState;
  systemSinrAvg: number;
  packetLossPct: number;
  meshHopsAvg: number;
}

export type OperationalMode = 'live' | 'simulation';
export type TabKey = 'home' | 'dashboard' | 'simulate' | 'nodes' | 'alerts' | 'data-graphs' | 'settings';
export type LanguageKey = 'en' | 'hi' | 'es' | 'fr' | 'de';
export type ThemeMode = 'light' | 'dark';

export interface ScenarioKeyframe {
  id: string;
  time: number; // in seconds (e.g. 0.0, 4.0, 8.0, 12.0)
  phaseName: string;
  positions: Record<string, { x: number; y: number }>;
}

export interface SimulationScenario {
  scenarioName: string;
  durationSeconds: number;
  walls: ObstacleWall[];
  initialNodes: TacticalNode[];
  keyframes: ScenarioKeyframe[];
}

