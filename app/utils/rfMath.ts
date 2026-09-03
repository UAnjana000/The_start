import { TacticalNode, NodeLink, ObstacleWall, GhostNode, JammerState, LinkStatus } from '../types/tactical';

// RF Physical Constants
export const FREQ_MHZ_UHF = 433.0; // Voice & lightweight telemetry
export const FREQ_MHZ_LBAND = 1420.0; // High-throughput video stream
export const SPEED_OF_LIGHT = 299792458; // m/s
export const BASE_NOISE_FLOOR_DBM = -95.0; // Thermal noise floor
export const MIN_SINR_VIDEO_STREAM_DB = 14.0; // Min SINR for reliable L-Band video (1080p/720p)
export const MIN_SINR_VOICE_TELEMETRY_DB = 4.0; // Min SINR for voice & beacon

// Calculate Euclidean distance in meters
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.max(0.5, Math.sqrt(dx * dx + dy * dy));
}

// Line-segment intersection test to check if an RF path crosses an obstacle
function lineSegmentsIntersect(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number
): boolean {
  const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  };
  return (
    ccw(p1x, p1y, p3x, p3y, p4x, p4y) !== ccw(p2x, p2y, p3x, p3y, p4x, p4y) &&
    ccw(p1x, p1y, p2x, p2y, p3x, p3y) !== ccw(p1x, p1y, p2x, p2y, p4x, p4y)
  );
}

// Check how many walls an RF path passes through and compute cumulative attenuation
export function calculateWallAttenuation(
  n1: { x: number; y: number },
  n2: { x: number; y: number },
  walls: ObstacleWall[]
): { totalLossDb: number; isBlocked: boolean; hitCount: number } {
  let totalLoss = 0;
  let hitCount = 0;

  for (const wall of walls) {
    if (lineSegmentsIntersect(n1.x, n1.y, n2.x, n2.y, wall.x1, wall.y1, wall.x2, wall.y2)) {
      totalLoss += wall.attenuationDb;
      hitCount++;
    }
  }

  return {
    totalLossDb: totalLoss,
    isBlocked: hitCount > 0,
    hitCount,
  };
}

// Friis Free-Space Path Loss (FSPL) in dB
export function calculateFSPL(distanceMeters: number, freqMhz: number = FREQ_MHZ_LBAND): number {
  return 20 * Math.log10(distanceMeters) + 20 * Math.log10(freqMhz) - 27.55;
}

// Conformal 4-Patch Antenna Array Beamforming Gain
export function getAntennaSectorGain(
  nodeX: number,
  nodeY: number,
  targetX: number,
  targetY: number,
  activeSector: number
): number {
  const dx = targetX - nodeX;
  const dy = targetY - nodeY;
  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  const sectorAngles: Record<number, number> = { 1: 90, 2: 0, 3: 270, 4: 180 };
  const boresight = sectorAngles[activeSector] ?? 0;
  let angleDiff = Math.abs(angleDeg - boresight);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;

  if (angleDiff <= 45) {
    return 5.5 - (angleDiff / 45) * 2.0;
  } else if (angleDiff <= 90) {
    return 3.5 - ((angleDiff - 45) / 45) * 4.5;
  } else {
    return -2.5;
  }
}

// Automatically choose the optimal sector based on target direction
export function determineOptimalSector(nodeX: number, nodeY: number, targetX: number, targetY: number): number {
  const dx = targetX - nodeX;
  const dy = targetY - nodeY;
  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  if (angleDeg >= 45 && angleDeg < 135) return 1; // North
  if (angleDeg >= 315 || angleDeg < 45) return 2;  // East
  if (angleDeg >= 225 && angleDeg < 315) return 3; // South
  return 4; // West
}

// Calculate Bearing and Cardinal String
export function getBearingAndCardinal(fromX: number, fromY: number, toX: number, toY: number) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;

  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return {
    bearingDeg: Math.round(deg),
    cardinal: cardinals[index],
  };
}

// Compute Complete Link Budget & SINR between two arbitrary nodes
export function calculateLinkMetrics(
  fromNode: TacticalNode,
  toNode: TacticalNode,
  walls: ObstacleWall[],
  jammer: JammerState
): {
  distanceMeters: number;
  rssiDbm: number;
  sinrDb: number;
  status: LinkStatus;
  videoBitrateKbps: number;
  isBlockedByWall: boolean;
} {
  const distance = calculateDistance(fromNode.x, fromNode.y, toNode.x, toNode.y);
  const fspl = calculateFSPL(distance, FREQ_MHZ_LBAND);
  const wallLoss = calculateWallAttenuation(
    { x: fromNode.x, y: fromNode.y },
    { x: toNode.x, y: toNode.y },
    walls
  );

  const txGain = getAntennaSectorGain(fromNode.x, fromNode.y, toNode.x, toNode.y, fromNode.activeSector);
  const rxGain = getAntennaSectorGain(toNode.x, toNode.y, fromNode.x, fromNode.y, toNode.activeSector);

  const rssiDbm = fromNode.txPowerDbm + txGain + rxGain - fspl - wallLoss.totalLossDb;

  let effectiveNoiseFloor = BASE_NOISE_FLOOR_DBM;
  if (jammer.active) {
    if (jammer.targetZone === 'global') {
      effectiveNoiseFloor += jammer.noiseModifierDb;
    } else if (jammer.targetZone === 'sector_north' && (fromNode.y > 0 || toNode.y > 0)) {
      effectiveNoiseFloor += jammer.noiseModifierDb;
    } else if (jammer.targetZone === 'sector_south' && (fromNode.y < 0 || toNode.y < 0)) {
      effectiveNoiseFloor += jammer.noiseModifierDb;
    } else if (jammer.targetZone === 'deep_basement') {
      effectiveNoiseFloor += jammer.noiseModifierDb * (wallLoss.hitCount > 0 ? 1.2 : 0.4);
    }
  }

  const coChannelInterferenceDbm = -90.0;
  const interferenceLinear = Math.pow(10, coChannelInterferenceDbm / 10);
  const noiseLinear = Math.pow(10, effectiveNoiseFloor / 10);
  const totalInterferencePlusNoiseDbm = 10 * Math.log10(interferenceLinear + noiseLinear);

  const sinrDb = parseFloat((rssiDbm - totalInterferencePlusNoiseDbm).toFixed(1));

  let status: LinkStatus = 'healthy';
  let videoBitrateKbps = 4500;

  if (sinrDb >= MIN_SINR_VIDEO_STREAM_DB) {
    status = 'healthy';
    videoBitrateKbps = Math.min(6000, 2000 + Math.round((sinrDb - MIN_SINR_VIDEO_STREAM_DB) * 350));
  } else if (sinrDb >= 8.0) {
    status = 'degraded';
    videoBitrateKbps = Math.max(800, Math.round(sinrDb * 120));
  } else if (sinrDb >= MIN_SINR_VOICE_TELEMETRY_DB) {
    status = 'critical';
    videoBitrateKbps = 0;
  } else {
    status = 'broken';
    videoBitrateKbps = 0;
  }

  return {
    distanceMeters: parseFloat(distance.toFixed(1)),
    rssiDbm: parseFloat(rssiDbm.toFixed(1)),
    sinrDb,
    status,
    videoBitrateKbps,
    isBlockedByWall: wallLoss.isBlocked,
  };
}

// B.A.T.M.A.N. / OLSR Multi-Hop MANET Routing Tree Algorithm
export function computeAdHocMeshRouting(
  nodes: TacticalNode[],
  walls: ObstacleWall[],
  jammer: JammerState
): {
  updatedNodes: TacticalNode[];
  activeMeshLinks: NodeLink[];
} {
  const visibleNodes = nodes.filter(n => !n.isHidden);
  const anchorNode = visibleNodes.find(n => n.isAnchor || n.id === 'TANK-00') ?? visibleNodes[0];
  const nodeMap = new Map<string, TacticalNode>();
  visibleNodes.forEach(n => nodeMap.set(n.id, { ...n, hopCount: 0, routePath: [n.id] }));

  // Evaluate all pairwise candidate links (range < 24m)
  const candidateEdges: { fromId: string; toId: string; link: ReturnType<typeof calculateLinkMetrics> }[] = [];
  for (let i = 0; i < visibleNodes.length; i++) {
    for (let j = 0; j < visibleNodes.length; j++) {
      if (i === j) continue;
      const n1 = visibleNodes[i];
      const n2 = visibleNodes[j];
      
      // Offline nodes cannot transmit or relay data
      if (n1.isOffline || n2.isOffline) continue;

      const dist = calculateDistance(n1.x, n1.y, n2.x, n2.y);
      if (dist <= 26.0) {
        const link = calculateLinkMetrics(n1, n2, walls, jammer);
        candidateEdges.push({ fromId: n1.id, toId: n2.id, link });
      }
    }
  }

  // Multi-hop shortest-path routing (Dijkstra on link metric: penalty = 100 - SINR)
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const linkToParent = new Map<string, ReturnType<typeof calculateLinkMetrics>>();

  visibleNodes.forEach(n => distances.set(n.id, Infinity));
  if (anchorNode) {
    distances.set(anchorNode.id, 0);
  }

  const unvisited = new Set(visibleNodes.filter(n => !n.isOffline).map(n => n.id));

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let smallestDist = Infinity;
    Array.from(unvisited).forEach((id) => {
      const d = distances.get(id) ?? Infinity;
      if (d < smallestDist) {
        smallestDist = d;
        currentId = id;
      }
    });

    if (!currentId || smallestDist === Infinity) break;
    unvisited.delete(currentId);

    // Evaluate neighbor links
    const outbound = candidateEdges.filter(e => e.fromId === currentId && unvisited.has(e.toId));
    for (const edge of outbound) {
      // Cost metric: Higher SINR = Lower Cost. Broken/negative SINR has severe penalty.
      const linkCost = Math.max(1, 40 - edge.link.sinrDb) + (edge.link.isBlockedByWall ? 30 : 0);
      const alt = (distances.get(currentId) ?? 0) + linkCost;
      if (alt < (distances.get(edge.toId) ?? Infinity)) {
        distances.set(edge.toId, alt);
        previous.set(edge.toId, currentId);
        linkToParent.set(edge.toId, edge.link);
      }
    }
  }

  const activeMeshLinks: NodeLink[] = [];
  const updatedNodes: TacticalNode[] = [];

  for (const node of nodes) {
    if (node.isHidden) {
      updatedNodes.push(node);
      continue;
    }

    if (node.id === anchorNode.id) {
      updatedNodes.push({ ...node, hopCount: 0, nextHopId: 'TOC', routePath: ['TANK-00'], bottleneckSinrDb: 40.0 });
      continue;
    }

    if (node.isOffline) {
      updatedNodes.push({
        ...node,
        hopCount: 99,
        nextHopId: 'OFFLINE',
        routePath: [node.id, 'BROKEN'],
        bottleneckSinrDb: 0.0,
      });
      continue;
    }

    // Trace route path up to TANK-00
    const path: string[] = [node.id];
    let curr = node.id;
    let bottleneckSinr = 40.0;
    let firstHopParent = 'TANK-00';

    while (previous.has(curr)) {
      const parent = previous.get(curr)!;
      path.push(parent);
      if (curr === node.id) firstHopParent = parent;

      const pLink = linkToParent.get(curr);
      if (pLink) {
        bottleneckSinr = Math.min(bottleneckSinr, pLink.sinrDb);
      }
      curr = parent;
      if (curr === anchorNode.id) break;
    }

    // Set sector aiming at its upstream parent
    const parentNode = nodes.find(n => n.id === firstHopParent) || anchorNode;
    const optimalSector = determineOptimalSector(node.x, node.y, parentNode.x, parentNode.y);

    const directLink = linkToParent.get(node.id) || calculateLinkMetrics(node, parentNode, walls, jammer);
    activeMeshLinks.push({
      fromId: node.id,
      toId: firstHopParent,
      ...directLink,
      isMeshRoute: true,
    });

    updatedNodes.push({
      ...node,
      activeSector: optimalSector,
      hopCount: Math.max(1, path.length - 1),
      nextHopId: firstHopParent,
      routePath: path,
      bottleneckSinrDb: parseFloat(bottleneckSinr.toFixed(1)),
    });
  }

  return {
    updatedNodes,
    activeMeshLinks,
  };
}

// Ad-Hoc Network Healing Algorithm: Multi-hop Waypoint Optimization
export function computeGhostHealingWaypoints(
  nodes: TacticalNode[],
  walls: ObstacleWall[],
  jammer: JammerState
): GhostNode[] {
  const ghostNodes: GhostNode[] = [];
  const anchorNode = nodes.find(n => n.isAnchor || n.id === 'TANK-00') ?? nodes[0];

  for (const node of nodes) {
    if (node.id === anchorNode.id) continue;

    // Upstream target is its direct next hop relay
    const parentNode = nodes.find(n => n.id === node.nextHopId) || anchorNode;
    const currentLink = calculateLinkMetrics(node, parentNode, walls, jammer);

    // If SINR drops below video threshold (< 14 dB)
    if (currentLink.sinrDb < MIN_SINR_VIDEO_STREAM_DB) {
      let bestX = node.x;
      let bestY = node.y;
      let bestSinr = currentLink.sinrDb;

      const angleToParent = Math.atan2(parentNode.y - node.y, parentNode.x - node.x);
      const candidateDistances = [2.5, 4.5, 7.0, 9.5, 13.0];
      const angleOffsets = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1];

      for (const dist of candidateDistances) {
        for (const offset of angleOffsets) {
          const testAngle = angleToParent + offset;
          const candidateX = node.x + dist * Math.cos(testAngle);
          const candidateY = node.y + dist * Math.sin(testAngle);

          const virtualNode: TacticalNode = {
            ...node,
            x: candidateX,
            y: candidateY,
            activeSector: determineOptimalSector(candidateX, candidateY, parentNode.x, parentNode.y),
          };

          const virtualLink = calculateLinkMetrics(virtualNode, parentNode, walls, jammer);
          if (virtualLink.sinrDb > bestSinr) {
            bestSinr = virtualLink.sinrDb;
            bestX = candidateX;
            bestY = candidateY;
          }
        }
      }

      const shiftDist = calculateDistance(node.x, node.y, bestX, bestY);
      if (shiftDist > 0.8 && bestSinr > currentLink.sinrDb + 3.0) {
        const { bearingDeg, cardinal } = getBearingAndCardinal(node.x, node.y, bestX, bestY);

        ghostNodes.push({
          targetNodeId: node.id,
          targetCallsign: node.callsign,
          optimalX: parseFloat(bestX.toFixed(1)),
          optimalY: parseFloat(bestY.toFixed(1)),
          currentX: node.x,
          currentY: node.y,
          shiftDistanceMeters: parseFloat(shiftDist.toFixed(1)),
          shiftBearingDeg: bearingDeg,
          shiftCardinal: `${shiftDist.toFixed(1)}m ${cardinal}`,
          predictedSinrGainDb: parseFloat((bestSinr - currentLink.sinrDb).toFixed(1)),
          actionRequired: 'reposition_relay',
          relayForNodeId: node.nextHopId,
        });
      }
    }
  }

  return ghostNodes;
}
