import type {
  Environment,
  LinkSample,
  LinkStatus,
  QualityClass,
  SimLink,
  SimNode,
  SimSettings,
  Wall,
  WallMaterial,
  ZoneConfig,
} from './types'

export const AREA_W = 900
export const AREA_H = 600
export const NODE_IDS = ['Gateway', 'Node_A', 'Node_B', 'Node_C', 'Node_D', 'Node_E', 'Node_F']

const MATERIALS: Record<WallMaterial, [number, number]> = {
  GLASS: [2, 4],
  WOOD: [3, 6],
  BRICK: [6, 10],
  CONCRETE: [10, 16],
}

export function defaultZones(freq: 865 | 1200): ZoneConfig {
  if (freq === 865) return { strong: 80, good: 160, degraded: 250, critical: 350 }
  return { strong: 60, good: 130, degraded: 210, critical: 300 }
}

export function defaultSettings(partial?: Partial<SimSettings>): SimSettings {
  const frequencyMhz = partial?.frequencyMhz ?? 865
  return {
    environment: 'MIXED',
    txPowerDbm: 17,
    txGainDbi: 2,
    rxGainDbi: 2,
    sensitivityDbm: -100,
    shadowSigma: 2.5,
    rssiStrong: -62,
    rssiGood: -75,
    rssiDegraded: -86,
    rssiCritical: -96,
    wLatency: 0.2,
    wPacketLoss: 0.25,
    wDistance: 0.1,
    wRssi: 0.35,
    wBattery: 0.1,
    telemetryIntervalSec: 1,
    batteryDrain: 0.012,
    seed: 42,
    showMesh: true,
    showRoutesOnly: false,
    showFailed: false,
    showDistances: false,
    showRssi: true,
    showZones: true,
    ...partial,
    frequencyMhz,
    zones: partial?.zones ?? defaultZones(frequencyMhz),
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashPair(a: string, b: string, seed: number) {
  const key = [a, b].sort().join('|') + seed
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function gauss(rng: () => number) {
  const u = Math.max(rng(), 1e-9)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function fsplDb(distanceM: number, freqMhz: number) {
  const dKm = Math.max(distanceM, 1) / 1000
  return 32.44 + 20 * Math.log10(dKm) + 20 * Math.log10(freqMhz)
}

function linkStatus(rssi: number, s: SimSettings): LinkStatus {
  if (rssi < s.sensitivityDbm || rssi < s.rssiCritical - 6) return 'DISCONNECTED'
  if (rssi >= s.rssiStrong) return 'STRONG'
  if (rssi >= s.rssiGood) return 'GOOD'
  if (rssi >= s.rssiDegraded) return 'DEGRADED'
  return 'CRITICAL'
}

function qualityClass(score: number): QualityClass {
  if (score >= 90) return 'EXCELLENT'
  if (score >= 75) return 'GOOD'
  if (score >= 50) return 'DEGRADED'
  if (score >= 25) return 'CRITICAL'
  return 'FAILED'
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

export function bearingSector(dx: number, dy: number) {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  const norm = (deg + 360) % 360
  if (norm < 45 || norm >= 315) return 1
  if (norm < 135) return 2
  if (norm < 225) return 3
  return 4
}

function sectorGain(active: number, facing: number) {
  const diff = Math.min(Math.abs(active - facing), 4 - Math.abs(active - facing))
  if (diff === 0) return 5
  if (diff === 1) return -2
  return -9
}

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
) {
  const d1x = bx - ax
  const d1y = by - ay
  const d2x = dx - cx
  const d2y = dy - cy
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-9) return false
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98
}

export function wallsOnPath(x1: number, y1: number, x2: number, y2: number, walls: Wall[]) {
  let loss = 0
  let count = 0
  const types: string[] = []
  for (const w of walls) {
    if (segmentsIntersect(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2)) {
      count += 1
      loss += w.lossDb
      types.push(w.material)
    }
  }
  return { count, loss, types: types.join('|') }
}

function pointInRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

interface Rect { x: number; y: number; w: number; h: number; name: string }

function addWall(walls: Wall[], x1: number, y1: number, x2: number, y2: number, material: WallMaterial, loss: number, isOuter: boolean) {
  if (Math.hypot(x2 - x1, y2 - y1) < 4) return
  walls.push({ x1, y1, x2, y2, material, lossDb: loss, isOuter })
}

function wallWithDoor(
  walls: Wall[],
  x1: number, y1: number, x2: number, y2: number,
  material: WallMaterial,
  loss: number,
  doorAt: number,
  doorSize: number,
  isOuter: boolean,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < doorSize + 8) {
    addWall(walls, x1, y1, x2, y2, material, loss, isOuter)
    return
  }
  const gap = doorSize / len
  const a = clamp(doorAt - gap / 2, 0.08, 0.82)
  const b = clamp(doorAt + gap / 2, a + 0.05, 0.92)
  addWall(walls, x1, y1, x1 + dx * a, y1 + dy * a, material, loss, isOuter)
  addWall(walls, x1 + dx * b, y1 + dy * b, x2, y2, material, loss, isOuter)
}

export function generateBuilding(environment: Environment, seed: number): { walls: Wall[]; footprint: Rect | null; rooms: Rect[] } {
  if (environment === 'OUTDOOR') return { walls: [], footprint: null, rooms: [] }
  const rng = mulberry32(seed + 17)
  const footprint: Rect = environment === 'INDOOR'
    ? { x: 50, y: 40, w: 800, h: 520, name: 'BUILDING' }
    : { x: 390, y: 70, w: 460, h: 430, name: 'BUILDING' }

  const rooms: Rect[] = []
  const walls: Wall[] = []
  const pickMat = (): WallMaterial => {
    const roll = rng()
    if (roll < 0.2) return 'GLASS'
    if (roll < 0.45) return 'WOOD'
    if (roll < 0.75) return 'BRICK'
    return 'CONCRETE'
  }
  const lossFor = (m: WallMaterial) => {
    const [a, b] = MATERIALS[m]
    return a + rng() * (b - a)
  }

  const outerMat: WallMaterial = 'CONCRETE'
  const outerLoss = 12
  wallWithDoor(walls, footprint.x, footprint.y, footprint.x + footprint.w, footprint.y, outerMat, outerLoss, 0.22, 18, true)
  addWall(walls, footprint.x + footprint.w, footprint.y, footprint.x + footprint.w, footprint.y + footprint.h, outerMat, outerLoss, true)
  addWall(walls, footprint.x + footprint.w, footprint.y + footprint.h, footprint.x, footprint.y + footprint.h, outerMat, outerLoss, true)
  addWall(walls, footprint.x, footprint.y + footprint.h, footprint.x, footprint.y, outerMat, outerLoss, true)

  const corridorY = footprint.y + footprint.h * (0.42 + rng() * 0.08)
  const corridorH = 36 + rng() * 16
  const stairX = footprint.x + footprint.w * (0.62 + rng() * 0.12)
  const stairW = 70 + rng() * 30

  const matV = pickMat()
  wallWithDoor(walls, footprint.x, corridorY, stairX, corridorY, matV, lossFor(matV), 0.35, 16, false)
  wallWithDoor(walls, stairX + stairW, corridorY, footprint.x + footprint.w, corridorY, pickMat(), lossFor('BRICK'), 0.4, 14, false)
  wallWithDoor(walls, footprint.x, corridorY + corridorH, footprint.x + footprint.w * 0.55, corridorY + corridorH, pickMat(), lossFor('CONCRETE'), 0.5, 16, false)
  wallWithDoor(walls, footprint.x + footprint.w * 0.55, corridorY + corridorH, footprint.x + footprint.w, corridorY + corridorH, pickMat(), lossFor('BRICK'), 0.45, 14, false)

  const midX = footprint.x + footprint.w * (0.38 + rng() * 0.1)
  wallWithDoor(walls, midX, footprint.y, midX, corridorY, pickMat(), lossFor('CONCRETE'), 0.55, 14, false)
  wallWithDoor(walls, stairX, corridorY, stairX, corridorY + corridorH, 'BRICK', lossFor('BRICK'), 0.5, 12, false)
  wallWithDoor(walls, stairX + stairW, corridorY, stairX + stairW, footprint.y + footprint.h, 'CONCRETE', lossFor('CONCRETE'), 0.6, 14, false)

  const leftSplit = footprint.x + (midX - footprint.x) * 0.55
  wallWithDoor(walls, leftSplit, footprint.y, leftSplit, corridorY, 'WOOD', lossFor('WOOD'), 0.5, 12, false)

  rooms.push(
    { x: footprint.x, y: footprint.y, w: leftSplit - footprint.x, h: corridorY - footprint.y, name: 'ROOM A' },
    { x: leftSplit, y: footprint.y, w: midX - leftSplit, h: corridorY - footprint.y, name: 'ROOM B' },
    { x: midX, y: footprint.y, w: footprint.x + footprint.w - midX, h: corridorY - footprint.y, name: 'ROOM C' },
    { x: footprint.x, y: corridorY, w: stairX - footprint.x, h: corridorH, name: 'CORRIDOR' },
    { x: stairX, y: corridorY, w: stairW, h: corridorH, name: 'STAIRWELL' },
    { x: stairX + stairW, y: corridorY, w: footprint.x + footprint.w - (stairX + stairW), h: corridorH, name: 'CORRIDOR' },
    { x: footprint.x, y: corridorY + corridorH, w: footprint.w * 0.55, h: footprint.y + footprint.h - (corridorY + corridorH), name: 'ROOM D' },
    { x: footprint.x + footprint.w * 0.55, y: corridorY + corridorH, w: footprint.w * 0.45, h: footprint.y + footprint.h - (corridorY + corridorH), name: 'ROOM E' },
  )

  return { walls, footprint, rooms }
}

function makeNode(id: string, label: string, x: number, y: number, gateway: boolean, battery = 100): SimNode {
  return {
    id, label, x, y, battery,
    status: 'ACTIVE',
    isGateway: gateway,
    indoor: false,
    activeSector: 1,
    sectorRssi: [-80, -80, -80, -80],
    nextHop: gateway ? 'SELF' : 'NONE',
    selectedRoute: gateway ? 'Gateway' : 'DISCONNECTED',
    hopCount: gateway ? 0 : -1,
    neighbors: [],
    lastSeen: 0,
    movementState: 'MANUAL',
  }
}

export function placeNodes(environment: Environment, footprint: Rect | null, seed: number): SimNode[] {
  const rng = mulberry32(seed + 3)
  const jitter = (n: number) => n + (rng() - 0.5) * 18
  if (environment === 'OUTDOOR' || !footprint) {
    const gw = { x: 450, y: 300 }
    const ring = [
      ['Node_A', 'A', -70, -40],
      ['Node_B', 'B', 80, -55],
      ['Node_C', 'C', -90, 70],
      ['Node_D', 'D', 110, 60],
      ['Node_E', 'E', 20, -110],
      ['Node_F', 'F', 30, 130],
    ] as const
    return [
      makeNode('Gateway', 'GW', gw.x, gw.y, true),
      ...ring.map(([id, label, dx, dy]) => makeNode(id, label, jitter(gw.x + dx), jitter(gw.y + dy), false, 88 + rng() * 12)),
    ]
  }
  if (environment === 'INDOOR') {
    return [
      makeNode('Gateway', 'GW', jitter(footprint.x + 80), jitter(footprint.y + footprint.h - 70), true),
      makeNode('Node_A', 'A', jitter(footprint.x + 90), jitter(footprint.y + 80), false),
      makeNode('Node_B', 'B', jitter(footprint.x + footprint.w * 0.42), jitter(footprint.y + 90), false),
      makeNode('Node_C', 'C', jitter(footprint.x + footprint.w * 0.28), jitter(footprint.y + footprint.h * 0.5), false),
      makeNode('Node_D', 'D', jitter(footprint.x + footprint.w * 0.72), jitter(footprint.y + footprint.h * 0.48), false),
      makeNode('Node_E', 'E', jitter(footprint.x + footprint.w * 0.55), jitter(footprint.y + footprint.h - 80), false),
      makeNode('Node_F', 'F', jitter(footprint.x + footprint.w - 90), jitter(footprint.y + footprint.h - 90), false),
    ]
  }
  return [
    makeNode('Gateway', 'GW', jitter(160), jitter(300), true),
    makeNode('Node_A', 'A', jitter(250), jitter(160), false),
    makeNode('Node_B', 'B', jitter(footprint.x + 24), jitter(footprint.y + footprint.h * 0.48), false),
    makeNode('Node_C', 'C', jitter(footprint.x + footprint.w * 0.22), jitter(footprint.y + footprint.h * 0.48), false),
    makeNode('Node_D', 'D', jitter(footprint.x + footprint.w * 0.78), jitter(footprint.y + 90), false),
    makeNode('Node_E', 'E', jitter(footprint.x + footprint.w * 0.7), jitter(footprint.y + footprint.h * 0.5), false),
    makeNode('Node_F', 'F', jitter(footprint.x + footprint.w + 50), jitter(footprint.y + footprint.h * 0.75), false),
  ]
}

function pdrFromRssi(rssi: number, sensitivity: number, rng: () => number) {
  let base = 0
  if (rssi >= -62) base = 98
  else if (rssi >= -75) base = 86 + ((rssi + 75) / 13) * 12
  else if (rssi >= -86) base = 62 + ((rssi + 86) / 11) * 24
  else if (rssi >= sensitivity) base = 12 + ((rssi - sensitivity) / Math.max(1, -86 - sensitivity)) * 50
  const noise = (rng() - 0.5) * 4
  return clamp(base + noise, 0, 100)
}

function latencyMs(rssi: number, pdr: number, hops: number, rng: () => number) {
  const base = 16 + rng() * 10
  const hop = Math.max(hops, 1) * (8 + rng() * 7)
  const retry = ((100 - pdr) / 10) * (8 + rng() * 14)
  const weak = rssi < -75 ? (-75 - rssi) * 1.4 : 0
  return base + hop + retry + weak + rng() * 4
}

function scoreLink(rssi: number, pdr: number, latency: number, loss: number, sensitivity: number) {
  const normRssi = clamp(((rssi - sensitivity) / (-35 - sensitivity)) * 100, 0, 100)
  const invLat = clamp(100 - latency / 4.5, 0, 100)
  const invLoss = clamp(100 - loss, 0, 100)
  return clamp(0.4 * normRssi + 0.3 * pdr + 0.15 * invLat + 0.15 * invLoss, 0, 100)
}

export interface NetworkSnapshot {
  nodes: SimNode[]
  links: SimLink[]
  footprint: Rect | null
  rooms: Rect[]
}

export function evaluateNetwork(
  nodes: SimNode[],
  walls: Wall[],
  footprint: Rect | null,
  settings: SimSettings,
  simTime: number,
  drainBattery: boolean,
): NetworkSnapshot {
  const rng = mulberry32(settings.seed + Math.floor(simTime))
  const byId = new Map(nodes.map((n) => [n.id, { ...n, neighbors: [] as string[] }]))
  const gateway = byId.get('Gateway')!

  for (const n of byId.values()) {
    n.indoor = footprint ? pointInRect(n.x, n.y, footprint) : false
    if (!n.isGateway && drainBattery && n.status !== 'OFFLINE') {
      n.battery = Math.max(0, n.battery - settings.batteryDrain * (n.status === 'DISCONNECTED' ? 0.4 : 1))
    }
    if (!n.isGateway && n.battery <= 0) n.status = 'OFFLINE'
  }

  const ids = [...byId.keys()]
  const links: SimLink[] = []

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = byId.get(ids[i])!
      const b = byId.get(ids[j])!
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const offline = a.status === 'OFFLINE' || b.status === 'OFFLINE'
      const crossed = wallsOnPath(a.x, a.y, b.x, b.y, walls)
      const indoorish = a.indoor || b.indoor || crossed.count > 0
      const nExp = settings.environment === 'INDOOR' || indoorish ? 3.35 : 3.05
      const extra = 10 * (nExp - 2) * Math.log10(Math.max(dist, 1))
      const envLoss = settings.environment === 'INDOOR' ? 4 : indoorish && settings.environment === 'MIXED' ? 2 : 0
      const shadow = gauss(() => {
        const h = hashPair(a.id, b.id, settings.seed)
        return ((h % 10000) / 10000)
      }) * settings.shadowSigma * 0.35 + gauss(rng) * settings.shadowSigma * 0.65
      const faceA = bearingSector(b.x - a.x, b.y - a.y)
      const faceB = bearingSector(a.x - b.x, a.y - b.y)
      const gainA = sectorGain(faceA, faceA)
      const gainB = sectorGain(faceB, faceB)
      const sector = (gainA + gainB) / 2
      const fs = fsplDb(dist, settings.frequencyMhz)
      const pathLoss = fs + extra + envLoss + crossed.loss + shadow - sector
      let rssi = settings.txPowerDbm + settings.txGainDbi + settings.rxGainDbi - pathLoss
      rssi = clamp(rssi, -120, -30)
      const viable = !offline && rssi >= settings.sensitivityDbm && linkStatus(rssi, settings) !== 'DISCONNECTED'
      const pdr = viable ? pdrFromRssi(rssi, settings.sensitivityDbm, rng) : 0
      const packetLoss = clamp(100 - pdr + (rng() - 0.5) * 3, 0, 100)
      const latency = viable ? latencyMs(rssi, pdr, 1, rng) : 0
      const quality = viable ? scoreLink(rssi, pdr, latency, packetLoss, settings.sensitivityDbm) : 0
      const rssiPenalty = Math.max(0, -50 - rssi)
      const batPen = (a.battery < 20 ? 25 : 0) + (b.battery < 20 ? 25 : 0)
      const cost = viable
        ? settings.wRssi * rssiPenalty
          + settings.wPacketLoss * packetLoss
          + settings.wLatency * (latency / 10)
          + settings.wDistance * (dist / 50)
          + settings.wBattery * batPen
          + (100 - quality) * 0.05
        : Infinity

      links.push({
        source: a.id,
        target: b.id,
        distance: dist,
        frequencyMhz: settings.frequencyMhz,
        rssi,
        pdr,
        latency,
        packetLoss,
        wallsCrossed: crossed.count,
        wallTypes: crossed.types,
        wallLossDb: crossed.loss,
        pathLossDb: pathLoss,
        sourceSector: faceA,
        targetSector: faceB,
        linkQuality: quality,
        linkClass: qualityClass(quality),
        status: offline ? 'DISCONNECTED' : linkStatus(rssi, settings),
        isNeighbour: viable,
        isActiveRoute: false,
        cost,
      })
    }
  }

  const adj = new Map<string, { to: string; cost: number; link: SimLink }[]>()
  for (const id of ids) adj.set(id, [])
  for (const link of links) {
    if (!link.isNeighbour) continue
    adj.get(link.source)!.push({ to: link.target, cost: link.cost, link })
    adj.get(link.target)!.push({ to: link.source, cost: link.cost, link })
    byId.get(link.source)!.neighbors.push(link.target)
    byId.get(link.target)!.neighbors.push(link.source)
  }

  const active = new Set<string>()
  for (const node of byId.values()) {
    if (node.isGateway || node.status === 'OFFLINE') continue
    const dist = new Map<string, number>(ids.map((id) => [id, Infinity]))
    const prev = new Map<string, string | null>(ids.map((id) => [id, null]))
    dist.set(node.id, 0)
    const used = new Set<string>()
    while (used.size < ids.length) {
      let u: string | null = null
      let best = Infinity
      for (const id of ids) {
        if (!used.has(id) && (dist.get(id) ?? Infinity) < best) {
          best = dist.get(id) ?? Infinity
          u = id
        }
      }
      if (u == null || best === Infinity) break
      used.add(u)
      if (u === 'Gateway') break
      for (const edge of adj.get(u) ?? []) {
        const alt = best + edge.cost
        if (alt < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, alt)
          prev.set(edge.to, u)
        }
      }
    }
    if ((dist.get('Gateway') ?? Infinity) === Infinity) {
      node.nextHop = 'NONE'
      node.selectedRoute = 'DISCONNECTED'
      node.hopCount = -1
      node.lastSeen += 1
      if (node.battery > 0 && node.battery < 20) node.status = 'LOW_BATTERY'
      else if (node.battery > 0) node.status = 'DISCONNECTED'
      continue
    }
    const path: string[] = []
    let cur: string | null = 'Gateway'
    while (cur) {
      path.push(cur)
      cur = prev.get(cur) ?? null
    }
    path.reverse()
    node.selectedRoute = path.join('>')
    node.nextHop = path[1] ?? 'NONE'
    node.hopCount = path.length - 1
    node.lastSeen = 0
    for (let k = 0; k < path.length - 1; k++) {
      active.add([path[k], path[k + 1]].sort().join('|'))
    }
    const hopLink = links.find((l) => {
      const key = [l.source, l.target].sort().join('|')
      return key === [node.id, node.nextHop].sort().join('|')
    })
    if (node.battery <= 0) node.status = 'OFFLINE'
    else if (node.battery < 20) node.status = 'LOW_BATTERY'
    else if (hopLink && (hopLink.status === 'DEGRADED' || hopLink.status === 'CRITICAL')) node.status = 'DEGRADED'
    else node.status = 'ACTIVE'
  }

  for (const link of links) {
    link.isActiveRoute = active.has([link.source, link.target].sort().join('|'))
    if (link.isActiveRoute) {
      const hops = Math.max(byId.get(link.source)?.hopCount ?? 1, byId.get(link.target)?.hopCount ?? 1)
      link.latency = latencyMs(link.rssi, link.pdr, Math.max(hops, 1), rng)
      link.linkQuality = scoreLink(link.rssi, link.pdr, link.latency, link.packetLoss, settings.sensitivityDbm)
      link.linkClass = qualityClass(link.linkQuality)
    }
  }

  for (const node of byId.values()) {
    if (node.isGateway) continue
    const facing = node.nextHop !== 'NONE'
      ? bearingSector((byId.get(node.nextHop)?.x ?? gateway.x) - node.x, (byId.get(node.nextHop)?.y ?? gateway.y) - node.y)
      : bearingSector(gateway.x - node.x, gateway.y - node.y)
    node.activeSector = facing
    const base = links
      .filter((l) => l.isNeighbour && (l.source === node.id || l.target === node.id))
      .sort((a, b) => b.rssi - a.rssi)[0]?.rssi ?? -110
    node.sectorRssi = [1, 2, 3, 4].map((s) => clamp(base + sectorGain(facing, s) + (rng() - 0.5) * 2, -120, -30)) as [number, number, number, number]
  }

  return { nodes: [...byId.values()], links, footprint, rooms: [] }
}

export function toLatLon(x: number, y: number) {
  const lat0 = 12.9716
  const lon0 = 77.5946
  const m = 111320
  return {
    latitude: lat0 + (y - 300) / m,
    longitude: lon0 + (x - 450) / (m * Math.cos((lat0 * Math.PI) / 180)),
  }
}

export function captureSamples(
  missionId: string,
  timestamp: number,
  environment: Environment,
  nodes: SimNode[],
  links: SimLink[],
): { nodes: import('./types').NodeSample[]; links: LinkSample[] } {
  const gw = nodes.find((n) => n.isGateway)!
  const nodeSamples = nodes.filter((n) => !n.isGateway).map((n) => {
    const geo = toLatLon(n.x, n.y)
    return {
      mission_id: missionId,
      timestamp,
      node_id: n.id,
      x: n.x,
      y: n.y,
      latitude: geo.latitude,
      longitude: geo.longitude,
      indoor: n.indoor,
      battery: n.battery,
      node_status: n.status,
      active_antenna_sector: n.activeSector,
      sector_rssi: [...n.sectorRssi],
      next_hop: n.nextHop,
      selected_route: n.selectedRoute,
      hop_count: n.hopCount,
      neighbor_count: n.neighbors.length,
      distance_to_gateway: Math.hypot(n.x - gw.x, n.y - gw.y),
    }
  })
  const linkSamples: LinkSample[] = links.map((l) => {
    const src = nodes.find((n) => n.id === l.source)!
    const sectors = src.sectorRssi
    const mean = sectors.reduce((a, b) => a + b, 0) / 4
    const variance = sectors.reduce((a, b) => a + (b - mean) ** 2, 0) / 4
    return {
      mission_id: missionId,
      timestamp,
      frequency_mhz: l.frequencyMhz,
      environment,
      source: l.source,
      target: l.target,
      distance: l.distance,
      walls_crossed: l.wallsCrossed,
      wall_types: l.wallTypes,
      path_loss_db: l.pathLossDb,
      rssi_dbm: l.rssi,
      pdr_percent: l.pdr,
      packet_loss_percent: l.packetLoss,
      latency_ms: l.latency,
      battery_level_percent: src.battery,
      hop_count: src.isGateway ? (nodes.find((n) => n.id === l.target)?.hopCount ?? 1) : src.hopCount,
      neighbor_count: src.isGateway ? (nodes.find((n) => n.id === l.target)?.neighbors.length ?? 0) : src.neighbors.length,
      mean_sector_rssi: mean,
      max_sector_rssi: Math.max(...sectors),
      min_sector_rssi: Math.min(...sectors),
      sector_rssi_variance: variance,
      actual_link_quality_score: l.linkQuality,
      actual_link_quality_class: l.linkClass,
      is_neighbour: l.isNeighbour ? 1 : 0,
      is_active_route: l.isActiveRoute ? 1 : 0,
      source_x: src.x,
      source_y: src.y,
      node_status: src.status,
    }
  })
  return { nodes: nodeSamples, links: linkSamples }
}

export function networkHealth(nodes: SimNode[], links: SimLink[]) {
  const comms = nodes.filter((n) => !n.isGateway && n.status !== 'OFFLINE')
  if (!comms.length) return 0
  const connected = comms.filter((n) => n.hopCount > 0).length / comms.length
  const activeLinks = links.filter((l) => l.isActiveRoute)
  const avgPdr = activeLinks.length ? activeLinks.reduce((a, l) => a + l.pdr, 0) / activeLinks.length : 0
  const avgQ = activeLinks.length ? activeLinks.reduce((a, l) => a + l.linkQuality, 0) / activeLinks.length : 0
  const batt = comms.reduce((a, n) => a + n.battery, 0) / comms.length
  return clamp(0.3 * connected * 100 + 0.3 * avgPdr + 0.25 * avgQ + 0.15 * batt, 0, 100)
}
