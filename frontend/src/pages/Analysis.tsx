import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

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

export default function Analysis() {
  const report = useMemo(() => {
    const raw = sessionStorage.getItem('mesh_analysis')
    return raw ? (JSON.parse(raw) as Report) : null
  }, [])
  const [node, setNode] = useState('ALL')
  if (!report) {
    return (
      <div className="p-8">
        <p>No mission analysis yet.</p>
        <Link to="/simulation" className="text-secondary">Return to the live simulator and click ANALYZE.</Link>
      </div>
    )
  }
  const shown = node === 'ALL' ? report.nodes : report.nodes.filter((n) => n.node_id === node)
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <div className="text-xs tracking-widest text-secondary">{report.label}</div>
        <h1 className="text-2xl font-bold">SIMULATION ANALYSIS · {report.mission_id}</h1>
        <p className="text-xs text-gray-400 max-w-3xl mt-2">{report.note} Prototype frequencies only. Not an official NSG operating frequency.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-gray-300">
        {['LIVE SIMULATOR', `${report.samples} LINK SAMPLES`, 'FEATURE ENGINEERING', 'SAVED XGBOOST', 'PREDICTIONS', 'GROUND TRUTH', 'CONFUSION MATRIX'].map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            <span className="glass-panel px-2 py-1">{step}</span>
            {i < 6 && <span className="text-primary">↓</span>}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Card label="DURATION" value={`${report.duration_s}s`} />
        <Card label="ENVIRONMENT" value={report.environment} />
        <Card label="FREQUENCY" value={`${report.frequency_mhz} MHz`} />
        <Card label="SAMPLES" value={String(report.samples)} />
        <Card label="ACCURACY" value={`${(report.accuracy * 100).toFixed(1)}%`} />
        <Card label="MACRO F1" value={report.macro_f1.toFixed(2)} />
        <Card label="MAE" value={report.mae.toFixed(2)} />
        <Card label="RMSE / R²" value={`${report.rmse.toFixed(2)} / ${report.r2.toFixed(2)}`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-panel p-4 overflow-x-auto">
          <h2 className="text-sm font-bold mb-3">CONFUSION MATRIX</h2>
          <table className="text-xs font-mono w-full text-center">
            <thead>
              <tr><th className="text-left">ACTUAL \ PRED</th>{report.classes.map((c) => <th key={c}>{c.slice(0, 4)}</th>)}</tr>
            </thead>
            <tbody>
              {report.confusion_matrix.map((row, i) => (
                <tr key={report.classes[i]}>
                  <td className="text-left text-gray-400">{report.classes[i]}</td>
                  {row.map((v, j) => <td key={j} className={i === j ? 'text-healthy' : 'text-gray-200'}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="glass-panel p-4">
          <h2 className="text-sm font-bold mb-3">PER-CLASS METRICS</h2>
          <table className="text-xs font-mono w-full">
            <thead><tr className="text-gray-500"><th className="text-left">Class</th><th>P</th><th>R</th><th>F1</th><th>N</th></tr></thead>
            <tbody>
              {report.per_class.map((r) => (
                <tr key={r.class}><td>{r.class}</td><td>{r.precision.toFixed(2)}</td><td>{r.recall.toFixed(2)}</td><td>{r.f1.toFixed(2)}</td><td>{r.support}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="glass-panel p-4 h-72">
        <h2 className="text-sm font-bold mb-2">ACTUAL VS PREDICTED LINK QUALITY</h2>
        <ResponsiveContainer width="100%" height="85%">
          <ScatterChart>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="actual_link_quality_score" name="Actual" stroke="#94a3b8" domain={[0, 100]} />
            <YAxis dataKey="predicted_link_quality_score" name="Predicted" stroke="#94a3b8" domain={[0, 100]} />
            <ZAxis range={[20, 20]} />
            <Tooltip />
            <Scatter data={report.scatter} fill="#22d3ee" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="grid md:grid-cols-3 gap-3 text-xs font-mono">
        {Object.entries(report.network).map(([k, v]) => <Card key={k} label={k.replaceAll('_', ' ').toUpperCase()} value={typeof v === 'number' ? v.toFixed(1) : String(v)} />)}
      </div>
      <div className="glass-panel p-4">
        <div className="flex gap-2 mb-3">
          {['ALL', ...report.nodes.map((n) => n.node_id)].map((id) => (
            <button key={id} onClick={() => setNode(id)} className={`text-xs px-2 py-1 rounded border ${node === id ? 'border-secondary text-secondary' : 'border-white/10'}`}>{id.replace('Node_', '')}</button>
          ))}
        </div>
        <table className="text-xs font-mono w-full">
          <thead><tr className="text-gray-500"><th className="text-left">Node</th><th>Battery</th><th>Hops</th><th>Neighbours</th><th>Reroutes</th><th>Drops</th><th>MAE</th></tr></thead>
          <tbody>
            {shown.map((n) => (
              <tr key={n.node_id}><td>{n.node_id}</td><td>{n.avg_battery.toFixed(1)}</td><td>{n.avg_hop.toFixed(2)}</td><td>{n.avg_neighbors.toFixed(1)}</td><td>{n.route_changes}</td><td>{n.disconnect_rows}</td><td>{n.prediction_mae.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <BinTable title="WALL EFFECT" rows={report.wall_bins.map((b) => [b.walls, b.count, b.rssi.toFixed(1), b.pdr.toFixed(1), b.quality.toFixed(1)])} headers={['Walls', 'N', 'RSSI', 'PDR', 'Quality']} />
        <BinTable title="DISTANCE BUCKETS" rows={report.distance_bins.map((b) => [b.bucket, b.count, b.rssi.toFixed(1), `${(b.success * 100).toFixed(0)}%`, b.quality.toFixed(1)])} headers={['Range', 'N', 'RSSI', 'Connected', 'Quality']} />
      </div>
      <div className="glass-panel p-4 h-64">
        <h2 className="text-sm font-bold mb-2">MISSION TIMELINE · HOP COUNT</h2>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={report.timeline}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="t" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Line dataKey="hop" stroke="#22d3ee" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return <div className="glass-panel p-3"><div className="text-[10px] text-gray-500">{label}</div><div className="font-mono font-bold">{value}</div></div>
}

function BinTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="glass-panel p-4">
      <h2 className="text-sm font-bold mb-2">{title}</h2>
      <table className="text-xs font-mono w-full">
        <thead><tr className="text-gray-500">{headers.map((h) => <th key={h} className="text-left">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
