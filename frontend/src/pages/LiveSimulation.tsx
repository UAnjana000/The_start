import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Pause, Play, RotateCcw, Square } from 'lucide-react'
import {
  AREA_H,
  AREA_W,
  captureSamples,
  defaultSettings,
  defaultZones,
  evaluateNetwork,
  generateBuilding,
  networkHealth,
  placeNodes,
} from '../simulation/engine'
import type { LinkSample, NodeSample, SimEvent, SimLink, SimNode, SimSettings, Wall } from '../simulation/types'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#3b82f6',
  DEGRADED: '#f59e0b',
  LOW_BATTERY: '#f59e0b',
  DISCONNECTED: '#ef4444',
  OFFLINE: '#6b7280',
}

const LINK_COLOR: Record<string, string> = {
  STRONG: '#22d3ee',
  GOOD: '#3b82f6',
  DEGRADED: '#facc15',
  CRITICAL: '#f97316',
  DISCONNECTED: '#ef4444',
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export default function LiveSimulation() {
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<string | null>(null)
  const [settings, setSettings] = useState<SimSettings>(defaultSettings())
  const [walls, setWalls] = useState<Wall[]>([])
  const [rooms, setRooms] = useState<{ x: number; y: number; w: number; h: number; name: string }[]>([])
  const [footprint, setFootprint] = useState<{ x: number; y: number; w: number; h: number; name: string } | null>(null)
  const [nodes, setNodes] = useState<SimNode[]>([])
  const [links, setLinks] = useState<SimLink[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [timer, setTimer] = useState(0)
  const [missionId, setMissionId] = useState('SIM-READY')
  const [events, setEvents] = useState<SimEvent[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const samples = useRef<{ nodes: NodeSample[]; links: LinkSample[] }>({ nodes: [], links: [] })
  const prevRoutes = useRef<Record<string, string>>({})
  const layoutKey = useRef('')

  const rebuildLayout = (env = settings.environment, seed = settings.seed) => {
    const building = generateBuilding(env, seed)
    const placed = placeNodes(env, building.footprint, seed)
    setWalls(building.walls)
    setRooms(building.rooms)
    setFootprint(building.footprint)
    setNodes(placed)
    layoutKey.current = `${env}-${seed}`
  }

  useEffect(() => {
    rebuildLayout()
    // initial layout only; environment changes rebuild explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!nodes.length) return
    const snap = evaluateNetwork(nodes, walls, footprint, settings, timer, false)
    setLinks(snap.links)
    setNodes((prev) => prev.map((n) => {
      const next = snap.nodes.find((s) => s.id === n.id)
      if (!next) return n
      return { ...n, ...next, x: n.x, y: n.y, battery: running ? next.battery : n.battery }
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.map((n) => `${n.id}:${n.x.toFixed(1)}:${n.y.toFixed(1)}:${n.battery.toFixed(2)}`).join('|'), settings.frequencyMhz, settings.environment, walls.length])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setTimer((t) => t + settings.telemetryIntervalSec)
      setNodes((prev) => {
        const snap = evaluateNetwork(prev, walls, footprint, settings, timer, true)
        setLinks(snap.links)
        const captured = captureSamples(missionId, timer, settings.environment, snap.nodes, snap.links)
        samples.current.nodes.push(...captured.nodes)
        samples.current.links.push(...captured.links)
        for (const n of snap.nodes) {
          if (n.isGateway) continue
          const before = prevRoutes.current[n.id]
          if (before && before !== n.selectedRoute) {
            const kind = n.selectedRoute === 'DISCONNECTED' ? 'critical' : before === 'DISCONNECTED' ? 'success' : 'warning'
            const msg = n.selectedRoute === 'DISCONNECTED'
              ? `${n.id.replace('_', ' ')} disconnected. No viable route to Gateway.`
              : `${n.id.replace('_', ' ')} rerouted: ${n.selectedRoute.replaceAll('>', ' → ')}`
            setEvents((ev) => [{ time: timer, message: msg, type: kind }, ...ev].slice(0, 80))
          }
          prevRoutes.current[n.id] = n.selectedRoute
        }
        return snap.nodes
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, settings, walls, footprint, missionId, timer])

  const health = useMemo(() => networkHealth(nodes, links), [nodes, links])
  const selectedNode = nodes.find((n) => n.id === selected) ?? null
  const gw = nodes.find((n) => n.isGateway)

  const clientToMetres = (e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const p = pt.matrixTransform(ctm.inverse())
    return { x: Math.max(0, Math.min(AREA_W, p.x)), y: Math.max(0, Math.min(AREA_H, p.y)) }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const p = clientToMetres(e)
    const id = drag.current
    setNodes((prev) => prev.map((n) => (n.id === id && !n.isGateway ? { ...n, x: p.x, y: p.y } : n)))
  }

  const applyEnvironment = (environment: SimSettings['environment']) => {
    const next = { ...settings, environment }
    setSettings(next)
    rebuildLayout(environment, next.seed)
    setEvents((ev) => [{ time: timer, message: `Environment set to ${environment}. Building and links recalculated.`, type: 'info' }, ...ev])
  }

  const applyFrequency = (frequencyMhz: 865 | 1200) => {
    setSettings({ ...settings, frequencyMhz, zones: defaultZones(frequencyMhz) })
  }

  const start = () => {
    const id = `SIM-2026-${Math.floor(100 + Math.random() * 900)}`
    setMissionId(id)
    setTimer(0)
    samples.current = { nodes: [], links: [] }
    prevRoutes.current = {}
    setRunning(true)
    setEvents([{ time: 0, message: `Mission ${id} started. Prototype ${settings.frequencyMhz} MHz, ${settings.environment}.`, type: 'success' }])
  }

  const stop = () => {
    setRunning(false)
    setEvents((ev) => [{ time: timer, message: `Mission stopped. ${samples.current.links.length} link observations captured.`, type: 'warning' }, ...ev])
    const history = JSON.parse(localStorage.getItem('mesh_missions') || '[]')
    history.unshift({
      missionId, timer, frequency: settings.frequencyMhz, environment: settings.environment,
      linkCount: samples.current.links.length,
    })
    localStorage.setItem('mesh_missions', JSON.stringify(history.slice(0, 20)))
  }

  const analyze = async () => {
    if (!samples.current.links.length) {
      setEvents((ev) => [{ time: timer, message: 'Start and run the simulation before analysis. No mission samples yet.', type: 'warning' }, ...ev])
      return
    }
    setAnalyzing(true)
    try {
      const res = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission_id: missionId,
          duration_s: timer,
          frequency_mhz: settings.frequencyMhz,
          environment: settings.environment,
          links: samples.current.links,
          nodes: samples.current.nodes,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      sessionStorage.setItem('mesh_analysis', JSON.stringify(data))
      navigate('/analysis')
    } catch (err) {
      setEvents((ev) => [{ time: timer, message: `Analysis failed. Is the backend running on port 8000? ${String(err)}`, type: 'critical' }, ...ev])
    } finally {
      setAnalyzing(false)
    }
  }

  const visibleLinks = links.filter((l) => {
    if (l.isActiveRoute) return true
    if (settings.showRoutesOnly) return false
    if (l.isNeighbour && settings.showMesh) return true
    if (!l.isNeighbour && settings.showFailed && l.distance < settings.zones.critical) return true
    return false
  })

  const matrixIds = ['Gateway', 'Node_A', 'Node_B', 'Node_C', 'Node_D', 'Node_E', 'Node_F']

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="flex min-h-[640px]">
        <div className="flex-1 relative border-r border-white/10 min-w-0">
          <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 text-[10px] font-mono">
            <span className="glass-panel px-2 py-1">SIMULATED AREA {AREA_W} m × {AREA_H} m</span>
            <span className="glass-panel px-2 py-1 text-secondary">{settings.frequencyMhz} MHz PROTOTYPE</span>
            <span className="glass-panel px-2 py-1">{settings.environment}</span>
            <span className="glass-panel px-2 py-1 text-healthy">HEALTH {health.toFixed(0)}%</span>
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${AREA_W} ${AREA_H}`}
            className="w-full h-[640px] bg-[#07101c] touch-none"
            onPointerMove={onPointerMove}
            onPointerUp={() => { drag.current = null }}
            onPointerLeave={() => { drag.current = null }}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <g key={i}>
                <line x1={i * 100} y1={0} x2={i * 100} y2={AREA_H} stroke="rgba(255,255,255,0.04)" />
                <text x={i * 100 + 4} y={16} fill="rgba(255,255,255,0.35)" fontSize="11">{i * 100} m</text>
              </g>
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <line key={i} x1={0} y1={i * 100} x2={AREA_W} y2={i * 100} stroke="rgba(255,255,255,0.04)" />
            ))}
            {settings.showZones && gw && (
              <>
                <circle cx={gw.x} cy={gw.y} r={settings.zones.critical} fill="none" stroke="rgba(249,115,22,0.25)" strokeDasharray="6 6" />
                <circle cx={gw.x} cy={gw.y} r={settings.zones.degraded} fill="none" stroke="rgba(250,204,21,0.25)" strokeDasharray="4 6" />
                <circle cx={gw.x} cy={gw.y} r={settings.zones.good} fill="none" stroke="rgba(59,130,246,0.3)" />
                <circle cx={gw.x} cy={gw.y} r={settings.zones.strong} fill="none" stroke="rgba(34,211,238,0.45)" />
                <text x={gw.x + 8} y={gw.y - settings.zones.strong - 4} fill="#67e8f9" fontSize="11">SIMULATED RF ZONES</text>
              </>
            )}
            {rooms.map((r) => (
              <g key={r.name + r.x + r.y}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(59,130,246,0.04)" />
                <text x={r.x + 8} y={r.y + 16} fill="rgba(255,255,255,0.35)" fontSize="11">{r.name}</text>
              </g>
            ))}
            {walls.map((w, i) => (
              <line key={i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={w.material === 'CONCRETE' ? '#cbd5e1' : w.material === 'BRICK' ? '#d6a06a' : w.material === 'GLASS' ? '#7dd3fc' : '#a8a29e'} strokeWidth={w.isOuter ? 3.5 : 2.2} />
            ))}
            {visibleLinks.map((l) => {
              const a = nodes.find((n) => n.id === l.source)
              const b = nodes.find((n) => n.id === l.target)
              if (!a || !b) return null
              const active = l.isActiveRoute
              const failed = !l.isNeighbour
              const color = failed ? '#ef4444' : LINK_COLOR[l.status]
              const mx = (a.x + b.x) / 2
              const my = (a.y + b.y) / 2
              return (
                <g key={`${l.source}-${l.target}`}>
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={color}
                    strokeWidth={active ? 2.6 : 1}
                    strokeOpacity={active ? 0.95 : failed ? 0.35 : 0.4}
                    strokeDasharray={failed ? '3 4' : l.status === 'CRITICAL' ? '5 4' : undefined}
                  />
                  {active && (
                    <circle r="3.2" fill="#67e8f9">
                      <animateMotion dur="1.6s" repeatCount="indefinite" path={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} />
                    </circle>
                  )}
                  {(settings.showDistances || settings.showRssi) && l.isNeighbour && (
                    <text x={mx} y={my} fill="#e2e8f0" fontSize="10" textAnchor="middle">
                      {settings.showDistances ? `${l.distance.toFixed(0)} m` : ''}
                      {settings.showDistances && settings.showRssi ? ' · ' : ''}
                      {settings.showRssi ? `${l.rssi.toFixed(0)} dBm` : ''}
                    </text>
                  )}
                </g>
              )
            })}
            {nodes.map((n) => (
              <g key={n.id} onPointerDown={(e) => { if (!n.isGateway) { drag.current = n.id; (e.target as Element).setPointerCapture?.(e.pointerId) } setSelected(n.id) }} className={n.isGateway ? '' : 'cursor-grab'}>
                {n.isGateway && <circle cx={n.x} cy={n.y} r="16" fill="none" stroke="#1d4ed8" strokeWidth="2"><animate attributeName="r" values="14;22;14" dur="2.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.8;0.15;0.8" dur="2.4s" repeatCount="indefinite" /></circle>}
                <circle cx={n.x} cy={n.y} r={n.isGateway ? 11 : 9} fill={n.isGateway ? '#1e3a8a' : STATUS_COLOR[n.status]} stroke={selected === n.id ? '#67e8f9' : '#0b1220'} strokeWidth={selected === n.id ? 3 : 1.5} />
                <text x={n.x} y={n.y + 3} textAnchor="middle" fill="white" fontSize="9" fontWeight="700">{n.label}</text>
                <text x={n.x} y={n.y + 22} textAnchor="middle" fill="#cbd5e1" fontSize="9">{n.indoor ? 'INDOOR' : n.isGateway ? 'GATEWAY' : `${Math.round(n.battery)}%`}</text>
              </g>
            ))}
            <g>
              <line x1="24" y1={AREA_H - 28} x2="124" y2={AREA_H - 28} stroke="#67e8f9" strokeWidth="2" />
              <text x="24" y={AREA_H - 34} fill="#67e8f9" fontSize="11">100 m</text>
            </g>
          </svg>
          <div className="h-36 overflow-y-auto border-t border-white/10 bg-black/30 p-3 font-mono text-xs space-y-1">
            {events.length === 0 && <div className="text-gray-500">Event log is empty. Drag a node or start the mission.</div>}
            {events.map((ev, i) => (
              <div key={i} className={clsx(ev.type === 'success' && 'text-healthy', ev.type === 'warning' && 'text-warning', ev.type === 'critical' && 'text-failure', ev.type === 'info' && 'text-gray-300')}>
                {fmtTime(ev.time)} — {ev.message}
              </div>
            ))}
          </div>
        </div>

        <aside className="w-[340px] shrink-0 bg-panel p-4 space-y-3 text-sm overflow-y-auto">
          <div className="font-bold tracking-widest text-xs">MISSION CONTROL</div>
          <div className="flex justify-between font-mono">
            <span>{fmtTime(timer)}</span>
            <span className="text-secondary">{missionId}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {!running ? (
              <button onClick={start} className="bg-healthy/20 text-healthy border border-healthy/30 rounded-lg py-2 flex items-center justify-center gap-1"><Play size={14} /> START</button>
            ) : (
              <button onClick={() => setRunning(false)} className="bg-warning/20 text-warning border border-warning/30 rounded-lg py-2 flex items-center justify-center gap-1"><Pause size={14} /> PAUSE</button>
            )}
            <button onClick={stop} className="bg-white/5 border border-white/10 rounded-lg py-2 flex items-center justify-center gap-1"><Square size={14} /> STOP</button>
            <button onClick={() => { setRunning(false); setTimer(0); samples.current = { nodes: [], links: [] }; rebuildLayout() }} className="bg-white/5 border border-white/10 rounded-lg py-2 flex items-center justify-center gap-1"><RotateCcw size={14} /> RESET</button>
            <button disabled={analyzing} onClick={analyze} className="bg-primary/30 text-white border border-primary rounded-lg py-2 font-bold disabled:opacity-50">{analyzing ? 'ANALYZING' : 'ANALYZE'}</button>
          </div>
          <label className="block text-[10px] text-gray-400">FREQUENCY — prototype simulation only</label>
          <div className="grid grid-cols-2 gap-2">
            {[865, 1200].map((f) => (
              <button key={f} onClick={() => applyFrequency(f as 865 | 1200)} className={clsx('rounded-lg py-2 border text-xs', settings.frequencyMhz === f ? 'border-secondary text-secondary' : 'border-white/10')}>{f === 865 ? '865 MHz' : '1.2 GHz'}</button>
            ))}
          </div>
          <label className="block text-[10px] text-gray-400">ENVIRONMENT</label>
          <div className="grid grid-cols-3 gap-1">
            {(['OUTDOOR', 'INDOOR', 'MIXED'] as const).map((env) => (
              <button key={env} onClick={() => applyEnvironment(env)} className={clsx('rounded py-1 text-[10px] border', settings.environment === env ? 'border-primary text-primary' : 'border-white/10')}>{env}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-1 text-[11px]">
            <Toggle label="Show all mesh links" checked={settings.showMesh} onChange={(v) => setSettings({ ...settings, showMesh: v, showRoutesOnly: v ? settings.showRoutesOnly : true })} />
            <Toggle label="Active routes only" checked={settings.showRoutesOnly} onChange={(v) => setSettings({ ...settings, showRoutesOnly: v, showMesh: v ? false : settings.showMesh })} />
            <Toggle label="Show failed links" checked={settings.showFailed} onChange={(v) => setSettings({ ...settings, showFailed: v })} />
            <Toggle label="Show distances" checked={settings.showDistances} onChange={(v) => setSettings({ ...settings, showDistances: v })} />
            <Toggle label="Show RSSI on links" checked={settings.showRssi} onChange={(v) => setSettings({ ...settings, showRssi: v })} />
            <Toggle label="Simulated RF zones" checked={settings.showZones} onChange={(v) => setSettings({ ...settings, showZones: v })} />
          </div>
          <button onClick={() => setShowSettings((s) => !s)} className="text-[10px] text-secondary">SIMULATION SETTINGS</button>
          {showSettings && (
            <div className="space-y-1 text-[11px] font-mono">
              <Num label="Tx power dBm" value={settings.txPowerDbm} onChange={(v) => setSettings({ ...settings, txPowerDbm: v })} />
              <Num label="Sensitivity dBm" value={settings.sensitivityDbm} onChange={(v) => setSettings({ ...settings, sensitivityDbm: v })} />
              <Num label="Shadow sigma" value={settings.shadowSigma} onChange={(v) => setSettings({ ...settings, shadowSigma: v })} />
              <Num label="Strong zone m" value={settings.zones.strong} onChange={(v) => setSettings({ ...settings, zones: { ...settings.zones, strong: v } })} />
              <Num label="Critical zone m" value={settings.zones.critical} onChange={(v) => setSettings({ ...settings, zones: { ...settings.zones, critical: v } })} />
              <p className="text-gray-500">Zones are demonstration guides. Connectivity uses calculated RSSI versus receiver sensitivity.</p>
            </div>
          )}
          {selectedNode && (
            <div className="border-t border-white/10 pt-3 space-y-1 font-mono text-xs">
              <div className="font-bold">{selectedNode.id.replace('_', ' ')} · {selectedNode.status}</div>
              <div>x {selectedNode.x.toFixed(1)} m · y {selectedNode.y.toFixed(1)} m</div>
              <div>Battery {selectedNode.battery.toFixed(1)}% · Sector {selectedNode.activeSector}</div>
              <div>Next hop {selectedNode.nextHop.replace('_', ' ')} · hops {selectedNode.hopCount}</div>
              <div className="text-primary break-all">{selectedNode.selectedRoute.replaceAll('>', ' → ').replaceAll('_', ' ')}</div>
              <div className="text-gray-400">Neighbours: {selectedNode.neighbors.map((n) => n.replace('Node_', '').replace('Gateway', 'GW')).join(', ') || 'none'}</div>
              <div className="pt-2 text-[10px] text-gray-500">DISTANCES</div>
              {nodes.filter((n) => n.id !== selectedNode.id).map((n) => (
                <div key={n.id} className="flex justify-between">
                  <span>{n.id.replace('Node_', '').replace('Gateway', 'GW')}</span>
                  <span>{Math.hypot(n.x - selectedNode.x, n.y - selectedNode.y).toFixed(0)} m</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-[10px] text-gray-500">Samples: {samples.current.links.length} links · {samples.current.nodes.length} node rows. Prototype RF simulation, not an official NSG frequency or a guaranteed coverage range.</div>
        </aside>
      </div>

      <div className="grid md:grid-cols-2 gap-4 p-4">
        <Matrix title="PAIRWISE DISTANCE (m)" ids={matrixIds} links={links} field="distance" digits={0} />
        <Matrix title="LINK QUALITY (%)" ids={matrixIds} links={links} field="linkQuality" digits={0} heat />
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex justify-between gap-2">
      <span className="text-gray-400">{label}</span>
      <input className="w-20 bg-background border border-white/10 rounded px-1" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Matrix({ title, ids, links, field, digits, heat }: { title: string; ids: string[]; links: SimLink[]; field: 'distance' | 'linkQuality'; digits: number; heat?: boolean }) {
  const find = (a: string, b: string) => links.find((l) => (l.source === a && l.target === b) || (l.source === b && l.target === a))
  const color = (v: number) => {
    if (!heat) return ''
    if (v >= 85) return 'text-healthy'
    if (v >= 70) return 'text-secondary'
    if (v >= 50) return 'text-warning'
    return 'text-failure'
  }
  return (
    <div className="glass-panel p-3 overflow-x-auto">
      <div className="text-xs font-bold tracking-widest mb-2">{title}</div>
      <table className="text-[10px] font-mono w-full text-center">
        <thead>
          <tr className="text-gray-500">
            <th />
            {ids.map((id) => <th key={id}>{id.replace('Node_', '').replace('Gateway', 'GW')}</th>)}
          </tr>
        </thead>
        <tbody>
          {ids.map((row) => (
            <tr key={row}>
              <td className="text-left text-gray-400">{row.replace('Node_', '').replace('Gateway', 'GW')}</td>
              {ids.map((col) => {
                if (row === col) return <td key={col}>—</td>
                const link = find(row, col)
                const v = link ? link[field] : 0
                return <td key={col} className={color(v)}>{link ? v.toFixed(digits) : '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
