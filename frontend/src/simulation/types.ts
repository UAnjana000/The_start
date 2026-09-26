export type Environment = 'OUTDOOR' | 'INDOOR' | 'MIXED'
export type NodeStatus = 'ACTIVE' | 'DEGRADED' | 'LOW_BATTERY' | 'DISCONNECTED' | 'OFFLINE'
export type LinkStatus = 'STRONG' | 'GOOD' | 'DEGRADED' | 'CRITICAL' | 'DISCONNECTED'
export type QualityClass = 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'CRITICAL' | 'FAILED'
export type WallMaterial = 'GLASS' | 'WOOD' | 'BRICK' | 'CONCRETE'

export interface Wall {
  x1: number
  y1: number
  x2: number
  y2: number
  material: WallMaterial
  lossDb: number
  isOuter: boolean
}

export interface SimNode {
  id: string
  label: string
  x: number
  y: number
  battery: number
  status: NodeStatus
  isGateway: boolean
  indoor: boolean
  activeSector: number
  sectorRssi: [number, number, number, number]
  nextHop: string
  selectedRoute: string
  hopCount: number
  neighbors: string[]
  lastSeen: number
  movementState: 'MANUAL' | 'STATIC'
}

export interface SimLink {
  source: string
  target: string
  distance: number
  frequencyMhz: number
  rssi: number
  pdr: number
  latency: number
  packetLoss: number
  wallsCrossed: number
  wallTypes: string
  wallLossDb: number
  pathLossDb: number
  sourceSector: number
  targetSector: number
  linkQuality: number
  linkClass: QualityClass
  status: LinkStatus
  isNeighbour: boolean
  isActiveRoute: boolean
  cost: number
}

export interface ZoneConfig {
  strong: number
  good: number
  degraded: number
  critical: number
}

export interface SimSettings {
  frequencyMhz: 865 | 1200
  environment: Environment
  txPowerDbm: number
  txGainDbi: number
  rxGainDbi: number
  sensitivityDbm: number
  shadowSigma: number
  rssiStrong: number
  rssiGood: number
  rssiDegraded: number
  rssiCritical: number
  zones: ZoneConfig
  wLatency: number
  wPacketLoss: number
  wDistance: number
  wRssi: number
  wBattery: number
  telemetryIntervalSec: number
  batteryDrain: number
  seed: number
  showMesh: boolean
  showRoutesOnly: boolean
  showFailed: boolean
  showDistances: boolean
  showRssi: boolean
  showZones: boolean
}

export interface LinkSample {
  mission_id: string
  timestamp: number
  frequency_mhz: number
  environment: Environment
  source: string
  target: string
  distance: number
  walls_crossed: number
  wall_types: string
  path_loss_db: number
  rssi_dbm: number
  pdr_percent: number
  packet_loss_percent: number
  latency_ms: number
  battery_level_percent: number
  hop_count: number
  neighbor_count: number
  mean_sector_rssi: number
  max_sector_rssi: number
  min_sector_rssi: number
  sector_rssi_variance: number
  actual_link_quality_score: number
  actual_link_quality_class: QualityClass
  is_neighbour: number
  is_active_route: number
  source_x: number
  source_y: number
  node_status: NodeStatus
}

export interface NodeSample {
  mission_id: string
  timestamp: number
  node_id: string
  x: number
  y: number
  latitude: number
  longitude: number
  indoor: boolean
  battery: number
  node_status: NodeStatus
  active_antenna_sector: number
  sector_rssi: number[]
  next_hop: string
  selected_route: string
  hop_count: number
  neighbor_count: number
  distance_to_gateway: number
}

export interface SimEvent {
  time: number
  message: string
  type: 'info' | 'warning' | 'critical' | 'success'
}
