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
      <div className="flex items-center justify-between glass-panel p-4">
        <h1 className="text-xl font-bold tracking-widest flex items-center gap-2">
          <Activity className="text-primary" />
          NODE ANALYTICS
        </h1>
        <select 
          className="bg-background border border-white/10 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-primary"
          value={selectedNode}
          onChange={(e) => setSelectedNode(e.target.value)}
        >
          {['Node A', 'Node B', 'Node C', 'Node D', 'Node E', 'Node F'].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="RSSI HISTORY (dBm)" icon={<Signal size={16} className="text-secondary" />} color="#00E5FF">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: '#888' }} domain={[-100, -40]} />
              <Tooltip contentStyle={{ backgroundColor: '#050A12', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Line type="monotone" dataKey="rssi" stroke="#00E5FF" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="PDR HISTORY (%)" icon={<Activity size={16} className="text-healthy" />} color="#00E676">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="colorPdr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00E676" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00E676" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: '#888' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#050A12', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Area type="monotone" dataKey="pdr" stroke="#00E676" fillOpacity={1} fill="url(#colorPdr)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="LATENCY (ms)" icon={<Zap size={16} className="text-warning" />} color="#FFC400">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: '#888' }} />
              <Tooltip contentStyle={{ backgroundColor: '#050A12', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Line type="monotone" dataKey="latency" stroke="#FFC400" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="BATTERY DRAIN (%)" icon={<Battery size={16} className="text-primary" />} color="#0052FF">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="colorBat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0052FF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0052FF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: '#888' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#050A12', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Area type="step" dataKey="battery" stroke="#0052FF" fillOpacity={1} fill="url(#colorBat)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold tracking-widest mb-4 border-b border-white/10 pb-2">ROUTE HISTORY</h3>
        <div className="space-y-3 font-mono text-sm">
          <div className="flex justify-between items-center bg-white/5 p-3 rounded">
            <span className="text-gray-500">00:00</span>
            <span className="text-white">NODE A → GATEWAY</span>
            <span className="text-healthy text-xs">STRONG</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3 rounded">
            <span className="text-gray-500">00:41</span>
            <span className="text-white">NODE A → NODE B → GATEWAY</span>
            <span className="text-secondary text-xs">GOOD</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3 rounded">
            <span className="text-gray-500">01:13</span>
            <span className="text-white">NODE A → NODE C → NODE B → GATEWAY</span>
            <span className="text-warning text-xs">DEGRADED</span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3 rounded border border-failure/30">
            <span className="text-gray-500">01:46</span>
            <span className="text-failure">DISCONNECTED</span>
            <span className="text-failure text-xs">CRITICAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children, color }: { title: string, icon: React.ReactNode, children: React.ReactNode, color: string }) {
  return (
    <div className="glass-panel p-6 h-80 flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        {icon}
        <h3 className="text-sm font-bold tracking-widest" style={{ color }}>{title}</h3>
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
