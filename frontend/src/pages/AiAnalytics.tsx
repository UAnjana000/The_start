import { BrainCircuit, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AiAnalytics() {
  return (
    <div className="p-8 h-full overflow-y-auto flex flex-col gap-6">
      <div className="flex items-center gap-3.5 mb-2">
        <BrainCircuit className="text-warning w-8 h-8" />
        <h1 className="text-3xl font-black tracking-widest text-white">AI LINK INTELLIGENCE &amp; XGBOOST PREDICTION</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard title="NETWORK HEALTH" value="91%" icon={<Activity className="text-healthy w-6 h-6" />} color="text-healthy" />
        <StatCard title="BEST LINK (LOS)" value="B → GW" icon={<CheckCircle2 className="text-secondary w-6 h-6" />} color="text-secondary" />
        <StatCard title="AT-RISK NODE" value="NODE F" icon={<AlertTriangle className="text-failure w-6 h-6" />} color="text-failure" />
        <StatCard title="AI OPTIMIZATIONS" value="17" icon={<BrainCircuit className="text-warning w-6 h-6" />} color="text-warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 shadow-xl border border-white/15">
          <h3 className="text-base font-extrabold tracking-widest mb-6 border-b border-white/10 pb-3 text-white uppercase">
            XGBOOST FEATURE IMPORTANCE WEIGHTS
          </h3>
          <div className="space-y-4 font-mono text-base font-bold">
            <FeatureBar label="RSSI" value={85} color="bg-primary" />
            <FeatureBar label="PDR" value={72} color="bg-secondary" />
            <FeatureBar label="Latency" value={64} color="bg-warning" />
            <FeatureBar label="Distance" value={58} color="bg-primary" />
            <FeatureBar label="Battery" value={45} color="bg-healthy" />
            <FeatureBar label="Hop Count" value={38} color="bg-secondary" />
            <FeatureBar label="Sector RSSI" value={25} color="bg-primary" />
            <FeatureBar label="Neighbours" value={15} color="bg-gray-400" />
          </div>
        </div>

        <div className="glass-panel p-6 shadow-xl border border-white/15">
          <h3 className="text-base font-extrabold tracking-widest mb-6 border-b border-white/10 pb-3 text-white uppercase">
            PREDICTED LINK QUALITY MATRIX (0–100)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-base font-mono font-bold text-center">
              <thead>
                <tr className="text-gray-400 border-b border-white/15 text-sm">
                  <th className="p-3 text-left">FROM \ TO</th>
                  <th className="p-3 text-primary">GW</th>
                  <th className="p-3 text-primary">A</th>
                  <th className="p-3 text-primary">B</th>
                  <th className="p-3 text-primary">C</th>
                  <th className="p-3 text-primary">D</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <MatrixRow label="Node A" values={[82, null, 91, 62, 28]} />
                <MatrixRow label="Node B" values={[94, 88, null, 79, 55]} />
                <MatrixRow label="Node C" values={[44, 76, 82, null, 71]} />
                <MatrixRow label="Node D" values={[21, 35, 64, 74, null]} />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 mt-2 border-l-4 border-l-warning shadow-xl">
        <h3 className="text-lg font-black tracking-widest mb-4 text-warning">
          AI MULTI-HOP ROUTE RECOMMENDATION
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-black/30 p-5 rounded-xl border border-white/10">
            <div className="text-xs text-gray-400 font-bold mb-2 uppercase">CURRENT SUB-OPTIMAL ROUTE</div>
            <div className="font-mono text-white text-base font-extrabold bg-white/5 p-3.5 rounded-lg mb-3">
              NODE F → NODE D → NODE B → GATEWAY
            </div>
            <div className="flex justify-between items-center text-sm font-mono">
              <span className="text-gray-400 font-bold">MEASURED LINK QUALITY:</span>
              <span className="font-black text-warning text-base">61% (POOR)</span>
            </div>
          </div>
          <div className="bg-emerald-950/20 p-5 rounded-xl border border-emerald-500/40">
            <div className="text-xs text-healthy font-extrabold mb-2 uppercase">AI OPTIMIZED RECOMMENDATION</div>
            <div className="font-mono text-white text-base font-extrabold bg-healthy/15 border border-healthy/40 p-3.5 rounded-lg mb-3">
              NODE F → NODE E → NODE A → GATEWAY
            </div>
            <div className="flex justify-between items-center text-sm font-mono">
              <span className="text-gray-300 font-bold">PREDICTED LINK QUALITY:</span>
              <span className="font-black text-healthy text-lg">84% (+23% GAIN)</span>
            </div>
            <div className="mt-3 text-xs text-gray-300 italic font-medium">
              Rationale: +13 dB stronger aggregate RF margin, lower calculated packet drop probability, zero partition risk.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="glass-panel p-6 flex items-center justify-between shadow-lg border border-white/15">
      <div>
        <div className="text-xs text-gray-400 font-bold tracking-wider mb-1 uppercase">{title}</div>
        <div className={`text-3xl font-black font-mono ${color}`}>{value}</div>
      </div>
      <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">{icon}</div>
    </div>
  );
}

function FeatureBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 text-gray-300 font-bold">{label}</div>
      <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden p-0.5">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }}></div>
      </div>
      <div className="w-12 text-right text-white font-extrabold">{value}%</div>
    </div>
  );
}

function MatrixRow({ label, values }: { label: string, values: (number | null)[] }) {
  const getColor = (val: number | null) => {
    if (val === null) return 'text-gray-500 bg-white/5';
    if (val >= 80) return 'text-healthy bg-healthy/20 border border-healthy/30 font-black';
    if (val >= 60) return 'text-secondary bg-secondary/20 border border-secondary/30 font-bold';
    if (val >= 40) return 'text-warning bg-warning/20 border border-warning/30 font-bold';
    return 'text-failure bg-failure/20 border border-failure/30 font-bold';
  };

  return (
    <tr>
      <td className="p-3.5 text-left text-gray-200 font-bold">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="p-1.5">
          <div className={`py-2 px-3 rounded-lg ${getColor(v)}`}>
            {v === null ? '—' : `${v}%`}
          </div>
        </td>
      ))}
    </tr>
  );
}
