import { BrainCircuit, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AiAnalytics() {
  return (
    <div className="p-8 h-full overflow-y-auto flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-4">
        <BrainCircuit className="text-warning" size={24} />
        <h1 className="text-2xl font-bold tracking-widest">AI LINK INTELLIGENCE</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="NETWORK HEALTH" value="91%" icon={<Activity className="text-healthy" />} color="text-healthy" />
        <StatCard title="BEST LINK" value="B → GW" icon={<CheckCircle2 className="text-secondary" />} color="text-secondary" />
        <StatCard title="AT-RISK NODE" value="NODE F" icon={<AlertTriangle className="text-failure" />} color="text-failure" />
        <StatCard title="OPTIMIZATIONS" value="17" icon={<BrainCircuit className="text-warning" />} color="text-warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold tracking-widest mb-6 border-b border-white/10 pb-2">XGBOOST FEATURE IMPORTANCE</h3>
          <div className="space-y-4 font-mono text-sm">
            <FeatureBar label="RSSI" value={85} color="bg-primary" />
            <FeatureBar label="PDR" value={72} color="bg-secondary" />
            <FeatureBar label="Latency" value={64} color="bg-warning" />
            <FeatureBar label="Distance" value={58} color="bg-primary" />
            <FeatureBar label="Battery" value={45} color="bg-healthy" />
            <FeatureBar label="Hop Count" value={38} color="bg-secondary" />
            <FeatureBar label="Sector RSSI" value={25} color="bg-primary" />
            <FeatureBar label="Neighbours" value={15} color="bg-gray-500" />
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-sm font-bold tracking-widest mb-6 border-b border-white/10 pb-2">PREDICTED LINK QUALITY MATRIX</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono text-center">
              <thead>
                <tr className="text-gray-500 border-b border-white/10">
                  <th className="p-2 text-left">FROM \ TO</th>
                  <th className="p-2">GW</th>
                  <th className="p-2">A</th>
                  <th className="p-2">B</th>
                  <th className="p-2">C</th>
                  <th className="p-2">D</th>
                </tr>
              </thead>
              <tbody>
                <MatrixRow label="A" values={[82, null, 91, 62, 28]} />
                <MatrixRow label="B" values={[94, 88, null, 79, 55]} />
                <MatrixRow label="C" values={[44, 76, 82, null, 71]} />
                <MatrixRow label="D" values={[21, 35, 64, 74, null]} />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 mt-2 border-l-4 border-l-warning">
        <h3 className="text-sm font-bold tracking-widest mb-4">AI ROUTE RECOMMENDATION</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-xs text-gray-500 font-bold mb-2">CURRENT ROUTE</div>
            <div className="font-mono text-white bg-white/5 p-3 rounded mb-2">NODE F → NODE D → NODE B → GATEWAY</div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">LINK QUALITY</span>
              <span className="font-bold text-warning">61%</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-healthy font-bold mb-2">RECOMMENDED ROUTE</div>
            <div className="font-mono text-white bg-healthy/10 border border-healthy/30 p-3 rounded mb-2">NODE F → NODE E → NODE A → GATEWAY</div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">PREDICTED QUALITY</span>
              <span className="font-bold text-healthy">84%</span>
            </div>
            <div className="mt-3 text-xs text-gray-400 italic">
              Reason: +13 dB stronger aggregate RSSI, lower predicted packet loss, more stable neighbor availability.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="glass-panel p-6 flex items-center justify-between">
      <div>
        <div className="text-[10px] text-gray-500 font-bold tracking-wider mb-1">{title}</div>
        <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      </div>
      <div className="bg-white/5 p-3 rounded-lg">{icon}</div>
    </div>
  );
}

function FeatureBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-24 text-gray-400">{label}</div>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
      </div>
      <div className="w-8 text-right text-white">{value}</div>
    </div>
  );
}

function MatrixRow({ label, values }: { label: string, values: (number | null)[] }) {
  const getColor = (val: number | null) => {
    if (val === null) return 'text-gray-600';
    if (val >= 80) return 'text-healthy bg-healthy/10';
    if (val >= 60) return 'text-secondary bg-secondary/10';
    if (val >= 40) return 'text-warning bg-warning/10';
    return 'text-failure bg-failure/10';
  };

  return (
    <tr className="border-b border-white/5">
      <td className="p-3 text-left text-gray-400 font-bold">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="p-1">
          <div className={`py-2 rounded ${getColor(v)}`}>
            {v === null ? '—' : v}
          </div>
        </td>
      ))}
    </tr>
  );
}
