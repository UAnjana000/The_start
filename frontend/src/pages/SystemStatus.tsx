import { Server, Database, Cpu, Globe, Radio, Activity } from 'lucide-react';

export default function SystemStatus() {
  return (
    <div className="p-8 h-full overflow-y-auto space-y-8">
      <div className="flex items-center gap-3.5 mb-4">
        <Server className="text-primary w-8 h-8" />
        <h1 className="text-3xl font-black tracking-widest text-white">SUBSYSTEM STATUS &amp; C4ISR HEALTH</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatusCard title="COMMAND GATEWAY" status="ONLINE (ACTIVE)" icon={<Radio className="w-6 h-6" />} />
        <StatusCard title="REALTIME MESH ENGINE" status="RUNNING (30Hz)" icon={<Cpu className="w-6 h-6" />} />
        <StatusCard title="AI XGBOOST INFERENCE" status="ONLINE (v2.4)" icon={<BrainIcon />} />
        <StatusCard title="MISSION TELEMETRY DB" status="ONLINE (LOCKED)" icon={<Database className="w-6 h-6" />} />
        <StatusCard title="WEBSOCKET RELAY BRIDGE" status="ONLINE (8090)" icon={<Globe className="w-6 h-6" />} />
        <StatusCard title="MULTI-ANTENNA ROUTING" status="ONLINE (DIVERSITY)" icon={<NetworkIcon />} />
      </div>

      <div className="glass-panel p-6 shadow-xl border border-white/15">
        <h3 className="text-base font-extrabold tracking-widest mb-6 border-b border-white/10 pb-3 flex items-center gap-2.5 text-white uppercase">
          <Activity size={20} className="text-secondary" />
          AGGREGATE NETWORK PERFORMANCE TELEMETRY
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 font-mono">
          <MetricBox label="PACKETS GENERATED" value="1,245,892" />
          <MetricBox label="PACKETS DELIVERED" value="1,210,430" />
          <MetricBox label="PACKETS DROPPED" value="35,462" color="text-warning" />
          <MetricBox label="OVERALL MESH PDR" value="97.15%" color="text-healthy" />
          <MetricBox label="AVERAGE LATENCY" value="14.8 ms" color="text-secondary" />
          <MetricBox label="DYNAMIC ROUTE CHANGES" value="1,432" />
          <MetricBox label="ISOLATED PARTITIONS" value="0" color="text-healthy" />
          <MetricBox label="CONTINUOUS UPTIME" value="14:22:05" color="text-primary" />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, status, icon, type = 'healthy' }: { title: string, status: string, icon: React.ReactNode, type?: 'healthy'|'warning'|'failure' }) {
  const colors = {
    healthy: 'text-healthy bg-healthy/15 border-healthy/40',
    warning: 'text-warning bg-warning/15 border-warning/40',
    failure: 'text-failure bg-failure/15 border-failure/40',
  };

  return (
    <div className="glass-panel p-6 flex items-center gap-5 shadow-lg border border-white/15">
      <div className={`p-4 rounded-xl border ${colors[type]} shrink-0 shadow-md`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-400 font-bold tracking-wider mb-1.5 uppercase">{title}</div>
        <div className={`font-mono text-lg font-black ${type === 'healthy' ? 'text-healthy' : type === 'warning' ? 'text-warning' : 'text-failure'}`}>
          {status}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color = "text-white" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-black/40 p-5 rounded-xl border border-white/10 shadow-inner">
      <div className="text-xs text-gray-400 font-bold tracking-wider mb-2 uppercase">{label}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
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
