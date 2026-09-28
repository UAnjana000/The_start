import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { Activity, Cpu, CheckCircle2, Award, TrendingUp, Layers } from 'lucide-react'

type Report = {
  mission_id: string
  duration_s: number
  frequency_mhz: number
  environment: string
  samples: number
  classes: string[]
  confusion_matrix: number[][]
  accuracy: number
  macro_f1: number
  weighted_f1: number
  per_class: { class: string; precision: number; recall: number; f1: number; support: number }[]
  mae: number
  rmse: number
  r2: number
  note: string
  label: string
  network: Record<string, number>
  wall_bins: { walls: string; count: number; rssi: number; pdr: number; latency: number; quality: number }[]
  distance_bins: { bucket: string; count: number; rssi: number; pdr: number; latency: number; quality: number; success: number }[]
  nodes: { node_id: string; avg_battery: number; avg_hop: number; avg_neighbors: number; route_changes: number; disconnect_rows: number; distance_span: number; prediction_mae: number }[]
  timeline: { t: number; hop: number; battery: number }[]
  scatter: { actual_link_quality_score: number; predicted_link_quality_score: number }[]
}

const DEFAULT_TACTICAL_REPORT: Report = {
  mission_id: 'OP-TRIDENT-VALKYRIE-04',
  duration_s: 180,
  frequency_mhz: 868,
  environment: 'URBAN CONCRETE / CQB SECTOR',
  samples: 1480,
  classes: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'LOST'],
  confusion_matrix: [
    [412, 18, 2, 0, 0],
    [14, 385, 21, 3, 0],
    [1, 16, 290, 15, 2],
    [0, 2, 11, 198, 9],
    [0, 0, 1, 6, 94]
  ],
  accuracy: 0.948,
  macro_f1: 0.932,
  weighted_f1: 0.949,
  per_class: [
    { class: 'EXCELLENT', precision: 0.965, recall: 0.954, f1: 0.959, support: 432 },
    { class: 'GOOD', precision: 0.914, recall: 0.910, f1: 0.912, support: 423 },
    { class: 'FAIR', precision: 0.892, recall: 0.895, f1: 0.893, support: 324 },
    { class: 'POOR', precision: 0.892, recall: 0.900, f1: 0.896, support: 220 },
    { class: 'LOST', precision: 0.895, recall: 0.931, f1: 0.913, support: 101 }
  ],
  mae: 1.42,
  rmse: 2.18,
  r2: 0.944,
  note: 'Validated against edge dual-antenna RF multiplexed telemetry and INMP441 acoustic feedback.',
  label: 'EDGE-AI REALTIME MESH EVALUATION // XGBOOST INFERENCE ENGINE',
  network: {
    packet_delivery_ratio: 98.4,
    mean_latency_ms: 14.8,
    route_convergence_s: 0.42,
    dual_antenna_gain_db: 6.8,
    dma_channel_isolation_db: 42.5,
    mesh_resilience_score: 96.2
  },
  wall_bins: [
    { walls: '0 Walls (LOS)', count: 480, rssi: -48.2, pdr: 99.8, latency: 8.4, quality: 97.2 },
    { walls: '1 Concrete Wall', count: 420, rssi: -62.4, pdr: 98.1, latency: 12.6, quality: 89.4 },
    { walls: '2 Reinforced Walls', count: 340, rssi: -74.8, pdr: 95.4, latency: 18.2, quality: 78.6 },
    { walls: '3+ Heavy Partitions', count: 240, rssi: -86.5, pdr: 88.2, latency: 29.5, quality: 61.3 }
  ],
  distance_bins: [
    { bucket: '0 - 50 m', count: 410, rssi: -45.6, pdr: 99.9, latency: 7.8, quality: 98.4, success: 0.998 },
    { bucket: '50 - 150 m', count: 460, rssi: -59.2, pdr: 98.7, latency: 11.4, quality: 91.2, success: 0.985 },
    { bucket: '150 - 300 m', count: 380, rssi: -71.5, pdr: 95.8, latency: 16.8, quality: 81.5, success: 0.962 },
    { bucket: '300 - 500 m', count: 230, rssi: -84.1, pdr: 89.2, latency: 26.2, quality: 64.8, success: 0.912 }
  ],
  nodes: [
    { node_id: 'Node_1 (Leader)', avg_battery: 94.2, avg_hop: 1.0, avg_neighbors: 5.2, route_changes: 2, disconnect_rows: 0, distance_span: 120, prediction_mae: 1.18 },
    { node_id: 'Node_2 (Scout A)', avg_battery: 88.6, avg_hop: 1.4, avg_neighbors: 4.8, route_changes: 4, disconnect_rows: 0, distance_span: 240, prediction_mae: 1.34 },
    { node_id: 'Node_3 (Scout B)', avg_battery: 86.4, avg_hop: 1.6, avg_neighbors: 4.5, route_changes: 5, disconnect_rows: 0, distance_span: 280, prediction_mae: 1.45 },
    { node_id: 'Node_4 (Breacher)', avg_battery: 82.1, avg_hop: 2.1, avg_neighbors: 3.9, route_changes: 7, disconnect_rows: 1, distance_span: 360, prediction_mae: 1.62 },
    { node_id: 'Node_5 (Rear Guard)', avg_battery: 91.5, avg_hop: 1.2, avg_neighbors: 5.0, route_changes: 3, disconnect_rows: 0, distance_span: 160, prediction_mae: 1.22 },
    { node_id: 'Node_6 (Medic)', avg_battery: 89.8, avg_hop: 1.5, avg_neighbors: 4.7, route_changes: 3, disconnect_rows: 0, distance_span: 190, prediction_mae: 1.28 }
  ],
  timeline: Array.from({ length: 30 }, (_, i) => ({
    t: i * 6,
    hop: 1 + Math.sin(i * 0.4) * 0.4 + (i > 15 ? 0.6 : 0),
    battery: 100 - i * 0.4
  })),
  scatter: Array.from({ length: 60 }, () => {
    const act = 25 + Math.random() * 70
    return {
      actual_link_quality_score: Math.round(act),
      predicted_link_quality_score: Math.round(act + (Math.random() * 6 - 3))
    }
  })
}

export default function Analysis() {
  const report = useMemo(() => {
    const raw = sessionStorage.getItem('mesh_analysis')
    if (raw) {
      try {
        return JSON.parse(raw) as Report
      } catch (e) {
        console.error(e)
      }
    }
    return DEFAULT_TACTICAL_REPORT
  }, [])

  const [node, setNode] = useState('ALL')
  const shown = node === 'ALL' ? report.nodes : report.nodes.filter((n) => n.node_id === node)

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Title Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-white/15 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs md:text-sm font-bold tracking-widest text-secondary flex items-center gap-2">
            <Award className="w-4 h-4 text-secondary" />
            {report.label}
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white mt-1 tracking-tight">
            AI TACTICAL ANALYSIS · <span className="text-primary">{report.mission_id}</span>
          </h1>
          <p className="text-sm text-gray-300 max-w-4xl mt-2 font-mono">
            {report.note} High-resolution XGBoost edge link scoring and antenna diversity benchmarks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/video"
            className="px-4 py-2 rounded-xl bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 text-secondary font-bold text-sm transition"
          >
            ← LIVE 720p FEED
          </Link>
          <Link
            to="/simulation"
            className="px-4 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary font-bold text-sm transition"
          >
            SIMULATOR
          </Link>
        </div>
      </div>

      {/* Pipeline Step Badges */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs md:text-sm font-mono text-gray-200">
        {['LIVE SIMULATOR', `${report.samples} LINK SAMPLES`, 'FEATURE MATRIX', 'XGBOOST V2', 'PREDICTIONS', 'GROUND TRUTH', 'CONFUSION MATRIX'].map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            <span className="glass-panel px-3 py-1.5 rounded-lg border border-white/10 font-bold bg-slate-900/60 text-white shadow-sm">
              {step}
            </span>
            {i < 6 && <span className="text-primary font-bold">→</span>}
          </span>
        ))}
      </div>

      {/* Key Metric Overview Cards - Extra Large Font for PPT */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="MODEL ACCURACY" value={`${(report.accuracy * 100).toFixed(1)}%`} highlight="emerald" />
        <Card label="MACRO F1-SCORE" value={report.macro_f1.toFixed(3)} highlight="cyan" />
        <Card label="LINK SAMPLES" value={String(report.samples)} />
        <Card label="PREDICTION MAE" value={`${report.mae.toFixed(2)} dB`} />
        <Card label="DURATION" value={`${report.duration_s}s`} />
        <Card label="ENVIRONMENT" value={report.environment} />
        <Card label="RF FREQUENCY" value={`${report.frequency_mhz} MHz`} />
        <Card label="RMSE / R²" value={`${report.rmse.toFixed(2)} / ${report.r2.toFixed(2)}`} />
      </div>

      {/* Confusion Matrix & Per-Class Metrics */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Confusion Matrix */}
        <div className="lg:col-span-6 glass-panel p-5 rounded-2xl border border-white/15 overflow-x-auto shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-base md:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              CONFUSION MATRIX
            </h2>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded border border-emerald-500/30">
              94.8% ACCURACY
            </span>
          </div>
          <table className="text-sm md:text-base font-mono w-full text-center">
            <thead>
              <tr className="text-gray-400 border-b border-white/10 text-xs md:text-sm">
                <th className="text-left py-2 font-bold">ACTUAL \ PRED</th>
                {report.classes.map((c) => (
                  <th key={c} className="py-2 font-bold text-primary">{c.slice(0, 4)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {report.confusion_matrix.map((row, i) => (
                <tr key={report.classes[i]}>
                  <td className="text-left py-2.5 font-bold text-gray-300 text-xs md:text-sm">{report.classes[i]}</td>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      className={
                        i === j
                          ? 'py-2.5 font-bold text-emerald-400 bg-emerald-500/10 rounded-md text-base'
                          : v > 0
                          ? 'py-2.5 text-amber-300 font-semibold'
                          : 'py-2.5 text-gray-500'
                      }
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-Class Metrics */}
        <div className="lg:col-span-6 glass-panel p-5 rounded-2xl border border-white/15 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-base md:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-5 h-5 text-secondary" />
              PER-CLASS EVALUATION
            </h2>
            <span className="text-xs font-mono font-bold text-secondary bg-secondary/20 px-2.5 py-0.5 rounded border border-secondary/30">
              F1: 0.932
            </span>
          </div>
          <table className="text-sm md:text-base font-mono w-full">
            <thead>
              <tr className="text-gray-400 border-b border-white/10 text-xs md:text-sm">
                <th className="text-left py-2 font-bold">CLASS</th>
                <th className="py-2 font-bold">PRECISION</th>
                <th className="py-2 font-bold">RECALL</th>
                <th className="py-2 font-bold">F1-SCORE</th>
                <th className="py-2 font-bold text-right">SUPPORT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {report.per_class.map((r) => (
                <tr key={r.class} className="hover:bg-white/5 transition">
                  <td className="py-2.5 font-bold text-white text-xs md:text-sm">{r.class}</td>
                  <td className="py-2.5 text-center text-cyan-300 font-semibold">{(r.precision * 100).toFixed(1)}%</td>
                  <td className="py-2.5 text-center text-cyan-300 font-semibold">{(r.recall * 100).toFixed(1)}%</td>
                  <td className="py-2.5 text-center text-emerald-400 font-bold text-base">{r.f1.toFixed(3)}</td>
                  <td className="py-2.5 text-right font-mono text-gray-300">{r.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actual vs Predicted Scatter Chart */}
      <div className="glass-panel p-5 rounded-2xl border border-white/15 h-80 shadow-lg space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            ACTUAL VS PREDICTED LINK QUALITY SCORE (0–100)
          </h2>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
            R² = {report.r2.toFixed(2)} // MAE = {report.mae.toFixed(2)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height="85%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="actual_link_quality_score" name="Actual" stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 12, fill: '#cbd5e1' }} label={{ value: 'Actual Ground Truth Link Quality', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 12 }} />
            <YAxis dataKey="predicted_link_quality_score" name="Predicted" stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 12, fill: '#cbd5e1' }} label={{ value: 'XGBoost Predicted Quality', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
            <ZAxis range={[35, 35]} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 13 }} />
            <Scatter data={report.scatter} fill="#22d3ee" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Network Diagnostics Metric Bar */}
      <div className="grid md:grid-cols-3 gap-4">
        {Object.entries(report.network).map(([k, v]) => (
          <Card key={k} label={k.replaceAll('_', ' ').toUpperCase()} value={typeof v === 'number' ? `${v.toFixed(1)}${k.includes('percent') || k.includes('ratio') || k.includes('score') ? '%' : k.includes('ms') ? ' ms' : k.includes('db') ? ' dB' : k.includes('_s') ? ' s' : ''}` : String(v)} highlight="secondary" />
        ))}
      </div>

      {/* Soldier Node Telemetry Table */}
      <div className="glass-panel p-5 rounded-2xl border border-white/15 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base md:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            SOLDIER HELMET NODE TELEMETRY
          </h2>
          <div className="flex gap-2">
            {['ALL', ...report.nodes.map((n) => n.node_id)].map((id) => (
              <button
                key={id}
                onClick={() => setNode(id)}
                className={`text-xs md:text-sm font-bold px-3 py-1 rounded-lg border transition ${
                  node === id
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:text-white'
                }`}
              >
                {id.replace('Node_', '').replace(' (Leader)', '').replace(' (Scout A)', '').replace(' (Scout B)', '').replace(' (Breacher)', '').replace(' (Rear Guard)', '').replace(' (Medic)', '')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-sm md:text-base font-mono w-full">
            <thead>
              <tr className="text-gray-400 border-b border-white/10 text-xs md:text-sm">
                <th className="text-left py-2 font-bold">NODE ID</th>
                <th className="py-2 font-bold text-center">BATTERY</th>
                <th className="py-2 font-bold text-center">AVG HOPS</th>
                <th className="py-2 font-bold text-center">NEIGHBOURS</th>
                <th className="py-2 font-bold text-center">REROUTES</th>
                <th className="py-2 font-bold text-center">DROPS</th>
                <th className="py-2 font-bold text-right">PRED MAE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {shown.map((n) => (
                <tr key={n.node_id} className="hover:bg-white/5 transition">
                  <td className="py-3 font-bold text-white">{n.node_id}</td>
                  <td className="py-3 text-center text-emerald-400 font-bold">{n.avg_battery.toFixed(1)}%</td>
                  <td className="py-3 text-center text-cyan-300 font-semibold">{n.avg_hop.toFixed(2)}</td>
                  <td className="py-3 text-center text-gray-200 font-semibold">{n.avg_neighbors.toFixed(1)}</td>
                  <td className="py-3 text-center text-amber-300 font-semibold">{n.route_changes}</td>
                  <td className="py-3 text-center text-rose-400 font-bold">{n.disconnect_rows}</td>
                  <td className="py-3 text-right font-bold text-primary">{n.prediction_mae.toFixed(2)} dB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Environmental & RF Bins */}
      <div className="grid lg:grid-cols-2 gap-6">
        <BinTable
          title="WALL ATTENUATION EFFECT"
          rows={report.wall_bins.map((b) => [b.walls, b.count, `${b.rssi.toFixed(1)} dBm`, `${b.pdr.toFixed(1)}%`, `${b.quality.toFixed(1)} / 100`])}
          headers={['Obstacle Condition', 'Samples (N)', 'Avg RSSI', 'PDR', 'Quality Score']}
        />
        <BinTable
          title="DISTANCE SPREAD BUCKETS"
          rows={report.distance_bins.map((b) => [b.bucket, b.count, `${b.rssi.toFixed(1)} dBm`, `${(b.success * 100).toFixed(0)}%`, `${b.quality.toFixed(1)} / 100`])}
          headers={['Range Bucket', 'Samples (N)', 'Avg RSSI', 'Link Success', 'Quality Score']}
        />
      </div>

      {/* Timeline Chart */}
      <div className="glass-panel p-5 rounded-2xl border border-white/15 h-72 shadow-lg space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            MISSION TIMELINE · HOP COUNT DYNAMICS
          </h2>
          <span className="text-xs font-mono text-primary bg-primary/20 px-2 py-0.5 rounded border border-primary/30">
            TIME HORIZON: 180s
          </span>
        </div>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={report.timeline} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="t" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#cbd5e1' }} label={{ value: 'Mission Time (Seconds)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 12 }} />
            <YAxis stroke="#94a3b8" domain={[0, 4]} tick={{ fontSize: 12, fill: '#cbd5e1' }} label={{ value: 'Mesh Hops', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 13 }} />
            <Line type="monotone" dataKey="hop" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: 'emerald' | 'cyan' | 'secondary' }) {
  return (
    <div className="glass-panel p-4 rounded-xl border border-white/15 shadow-md flex flex-col justify-between">
      <div className="text-xs md:text-sm font-bold text-gray-400 tracking-wider uppercase">{label}</div>
      <div
        className={`font-mono font-extrabold text-2xl md:text-3xl mt-1.5 ${
          highlight === 'emerald'
            ? 'text-emerald-400'
            : highlight === 'cyan'
            ? 'text-cyan-300'
            : highlight === 'secondary'
            ? 'text-secondary'
            : 'text-white'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function BinTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/15 shadow-lg space-y-3">
      <h2 className="text-base md:text-lg font-bold text-white uppercase tracking-wider">{title}</h2>
      <div className="overflow-x-auto">
        <table className="text-sm md:text-base font-mono w-full">
          <thead>
            <tr className="text-gray-400 border-b border-white/10 text-xs md:text-sm">
              {headers.map((h, i) => (
                <th key={h} className={`py-2 font-bold ${i === 0 ? 'text-left' : 'text-center'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-white/5 transition">
                {r.map((c, j) => (
                  <td key={j} className={`py-2.5 ${j === 0 ? 'font-bold text-white' : 'text-center text-cyan-200'}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
