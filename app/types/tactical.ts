export type NodeRole = 'anchor' | 'pointman' | 'assault' | 'breacher' | 'marksman' | 'scout_relay' | 'uav_relay';
export type LinkStatus = 'healthy' | 'degraded' | 'critical' | 'broken';

export interface TacticalNode {
  id: string;
  callsign: string;
  displayName?: string;
  role: NodeRole;
  x: number; // relative coordinate in meters (GATEWAY is at 0,0)
  y: number;
  battery: number; // percentage (0 - 100)
  activeSector: number; // 1, 2, 3, 4 (smart beamforming conformal array)
  txPowerDbm: number;
  noiseFloorDbm: number;
  isAnchor?: boolean;
  videoActive?: boolean;
  hopCount?: number; // Multi-hop MANET hop count to GATEWAY
  nextHopId?: string; // Direct upstream mesh relay
  routePath?: string[]; // Full breadcrumb chain (e.g. ["Node 3", "Node 2", "GATEWAY"])
  bottleneckSinrDb?: number;
  isOffline?: boolean; // True when node loses connection
  lastOnlineX?: number; // Last known coordinates before connection loss
  lastOnlineY?: number;
  lastOnlineTimestamp?: number;
  isHidden?: boolean; // When deleted/hidden from primary view
  // Enhanced Nodal Identity, Geolocation, Kinematics & ML Early Warning
  deviceId?: string; // Hardware MAC / UID (e.g. "XIAO-ESP32-C6-A1F4")
  lat?: number; // Geolocation latitude
  lon?: number; // Geolocation longitude
  movementSpeedMs?: number; // Operator movement speed in m/s
  pdrPct?: number; // Packet Delivery Ratio %
  rssiDbm?: number; // Received Signal Strength in dBm
  sinrDb?: number; // Signal to Interference plus Noise Ratio in dB
  mlRiskScore?: number; // 0-100% predicted failure probability within next 5s
  mlWarning?: string; // Actionable micro-movement advice (e.g. "Step 1.5m East to maintain LOS")
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

