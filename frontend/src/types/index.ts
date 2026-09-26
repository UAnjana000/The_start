export type NodeStatus = 'ACTIVE' | 'DEGRADED' | 'LOW_BATTERY' | 'DISCONNECTED' | 'OFFLINE';
export type Environment = 'OUTDOOR' | 'INDOOR' | 'MIXED';
export type MovementState = 'STATIC' | 'WALKING' | 'PATROL' | 'RANDOM_WALK';

export interface Telemetry {
  mission_id: number | string;
  timestamp: number;
  node_id: string;
  latitude: number;
  longitude: number;
  simulation_x: number;
  simulation_y: number;
  frequency_mhz: number;
  environment: Environment;
  movement_state: MovementState;
  distance_to_gateway: number;
  rssi_dbm: number;
  pdr_percent: number;
  latency_ms: number;
  packet_loss_percent: number;
  battery_level_percent: number;
  active_antenna_sector: string;
  sector_1_rssi: number;
  sector_2_rssi: number;
  sector_3_rssi: number;
  sector_4_rssi: number;
  connected_neighbors: string;
  neighbor_count: number;
  next_hop: string;
  selected_route: string;
  hop_count: number;
  mesh_topology_snapshot: string;
  node_status: NodeStatus;
  last_seen_seconds: number;
  route_change: number;
  route_change_reason: string;
  predicted_link_quality: number;
  actual_link_quality_score: number;
  link_quality_class: string;
}

export interface NodeState {
  id: string;
  x: number;
  y: number;
  status: NodeStatus;
  telemetry?: Telemetry;
  isGateway?: boolean;
}

export interface EdgeState {
  source: string;
  target: string;
  quality: 'STRONG' | 'GOOD' | 'DEGRADED' | 'CRITICAL';
  rssi: number;
}
