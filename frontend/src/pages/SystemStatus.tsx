import { Server, Database, Cpu, Globe, Radio, Activity } from 'lucide-react';

export default function SystemStatus() {
  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-8">
        <Server className="text-primary" size={24} />
        <h1 className="text-2xl font-bold tracking-widest">SYSTEM STATUS</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatusCard title="GATEWAY STATUS" status="ONLINE" icon={<Radio />} />
        <StatusCard title="SIMULATION ENGINE" status="IDLE" icon={<Cpu />} type="warning" />
        <StatusCard title="AI MODEL" status="ONLINE" icon={<BrainIcon />} />
        <StatusCard title="DATABASE" status="ONLINE" icon={<Database />} />
        <StatusCard title="WEBSOCKET" status="ONLINE" icon={<Globe />} />
        <StatusCard title="MESH ROUTING ENGINE" status="ONLINE" icon={<NetworkIcon />} />
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold tracking-widest mb-6 border-b border-white/10 pb-2 flex items-center gap-2">
          <Activity size={16} className="text-secondary" />
          NETWORK PERFORMANCE METRICS
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 font-mono">
          <MetricBox label="PACKETS GENERATED" value="1,245,892" />
          <MetricBox label="PACKETS DELIVERED" value="1,210,430" />
          <MetricBox label="PACKETS LOST" value="35,462" color="text-warning" />
          <MetricBox label="NETWORK PDR" value="97.15%" color="text-healthy" />
          <MetricBox label="AVERAGE LATENCY" value="42 ms" />
          <MetricBox label="ROUTE CHANGES" value="1,432" />
          <MetricBox label="DISCONNECTED NODES" value="0" color="text-healthy" />
          <MetricBox label="SIMULATION UPTIME" value="14:22:05" />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, status, icon, type = 'healthy' }: { title: string, status: string, icon: React.ReactNode, type?: 'healthy'|'warning'|'failure' }) {
  const colors = {
    healthy: 'text-healthy bg-healthy/10 border-healthy/30',
    warning: 'text-warning bg-warning/10 border-warning/30',
    failure: 'text-failure bg-failure/10 border-failure/30',
  };

  return (
    <div className="glass-panel p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg border ${colors[type]}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-500 font-bold tracking-wider mb-1">{title}</div>
        <div className={`font-mono font-bold ${type === 'healthy' ? 'text-healthy' : type === 'warning' ? 'text-warning' : 'text-failure'}`}>
          {status}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color = "text-white" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-white/5 p-4 rounded-lg border border-white/5">
      <div className="text-[10px] text-gray-500 font-bold tracking-wider mb-2">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function BrainIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="16" y="16" width="6" height="6" rx="1"/>
      <rect x="2" y="16" width="6" height="6" rx="1"/>
      <rect x="9" y="2" width="6" height="6" rx="1"/>
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>
      <path d="M12 12V8"/>
    </svg>
  );
}
