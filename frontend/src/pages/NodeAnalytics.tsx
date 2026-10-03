import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Battery, Signal, Zap } from 'lucide-react';

const mockData = Array.from({ length: 60 }).map((_, i) => ({
  time: i,
  rssi: -60 - Math.random() * 20,
  pdr: 90 + Math.random() * 10,
  latency: 20 + Math.random() * 30,
  battery: 100 - (i * 0.1),
}));

export default function NodeAnalytics() {
  const [selectedNode, setSelectedNode] = useState('Node A');

  return (
    <div className="p-8 h-full overflow-y-auto flex flex-col gap-6">
      <div className="flex items-center justify-between glass-panel p-5">
        <h1 className="text-2xl font-black tracking-widest flex items-center gap-3 text-white">
          <Activity className="text-primary w-6 h-6" />
          NODE ANALYTICS &amp; RF TELEMETRY
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-300 font-mono">TARGET NODE:</span>
          <select 
            className="bg-slate-900 border border-white/20 rounded-xl px-5 py-2.5 text-base font-bold font-mono text-primary focus:outline-none focus:border-primary shadow-sm cursor-pointer"
            value={selectedNode}
            onChange={(e) => setSelectedNode(e.target.value)}
          >
            {['Node A', 'Node B', 'Node C', 'Node D', 'Node E', 'Node F'].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="RSSI HISTORY (dBm)" icon={<Signal size={18} className="text-secondary" />} color="#22D3EE">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: '#cbd5e1' }} domain={[-100, -40]} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 13 }} />
              <Line type="monotone" dataKey="rssi" stroke="#22D3EE" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="PACKET DELIVERY RATIO PDR (%)" icon={<Activity size={18} className="text-healthy" />} color="#10B981">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="colorPdr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: '#cbd5e1' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 13 }} />
              <Area type="monotone" dataKey="pdr" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPdr)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="END-TO-END LATENCY (ms)" icon={<Zap size={18} className="text-warning" />} color="#FBBF24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 13 }} />
              <Line type="monotone" dataKey="latency" stroke="#FBBF24" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="BATTERY DRAIN DYNAMICS (%)" icon={<Battery size={18} className="text-primary" />} color="#38BDF8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="colorBat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: '#cbd5e1' }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: '#cbd5e1' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 13 }} />
              <Area type="step" dataKey="battery" stroke="#38BDF8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBat)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="glass-panel p-6 shadow-xl">
        <h3 className="text-base font-extrabold tracking-widest mb-4 border-b border-white/10 pb-3 uppercase text-gray-200">
          DYNAMIC ROUTE TRANSITION LOG
        </h3>
        <div className="space-y-3 font-mono text-base font-bold">
          <div className="flex justify-between items-center bg-white/5 p-3.5 rounded-xl border border-white/10">
            <span className="text-gray-400">00:00</span>
            <span className="text-white">NODE A → GATEWAY</span>
            <span className="text-healthy text-sm px-2.5 py-0.5 rounded bg-healthy/20 border border-healthy/40">STRONG</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3.5 rounded-xl border border-white/10">
            <span className="text-gray-400">00:41</span>
            <span className="text-white">NODE A → NODE B → GATEWAY</span>
            <span className="text-secondary text-sm px-2.5 py-0.5 rounded bg-secondary/20 border border-secondary/40">GOOD</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3.5 rounded-xl border border-white/10">
            <span className="text-gray-400">01:13</span>
            <span className="text-white">NODE A → NODE C → NODE B → GATEWAY</span>
            <span className="text-warning text-sm px-2.5 py-0.5 rounded bg-warning/20 border border-warning/40">DEGRADED</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3.5 rounded-xl border border-failure/40 bg-failure/5">
            <span className="text-gray-400">01:46</span>
            <span className="text-failure">DISCONNECTED (FAILOVER SEEKING)</span>
            <span className="text-failure text-sm px-2.5 py-0.5 rounded bg-failure/20 border border-failure/40">CRITICAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children, color }: { title: string, icon: React.ReactNode, children: React.ReactNode, color: string }) {
  return (
    <div className="glass-panel p-6 h-88 flex flex-col shadow-lg border border-white/15">
      <div className="flex items-center gap-2.5 mb-5">
        {icon}
        <h3 className="text-base font-extrabold tracking-widest" style={{ color }}>{title}</h3>
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
