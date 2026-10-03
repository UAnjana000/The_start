import { History, Play, Clock, Activity, Radio, AlertTriangle } from 'lucide-react';

const mockMissions = [
  { id: 'SIM-2026-001', date: '2026-09-24', duration: '08:42', nodes: 6, rssi: -69, pdr: 94.2, latency: 41, changes: 14, disconnects: 3 },
  { id: 'SIM-2026-002', date: '2026-09-24', duration: '12:15', nodes: 6, rssi: -72, pdr: 91.5, latency: 48, changes: 22, disconnects: 1 },
  { id: 'SIM-2026-003', date: '2026-09-23', duration: '05:30', nodes: 4, rssi: -55, pdr: 98.9, latency: 25, changes: 4, disconnects: 0 },
  { id: 'SIM-2026-004', date: '2026-09-22', duration: '15:00', nodes: 8, rssi: -81, pdr: 85.4, latency: 62, changes: 45, disconnects: 8 },
];

export default function MissionHistory() {
  return (
    <div className="p-8 h-full overflow-y-auto space-y-8">
      <div className="flex items-center gap-3.5 mb-4">
        <History className="text-secondary w-8 h-8" />
        <h1 className="text-3xl font-black tracking-widest text-white">HISTORICAL MISSION AUDIT TRAILS</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockMissions.map(mission => (
          <div key={mission.id} className="glass-panel p-6 flex flex-col shadow-xl border border-white/15 hover:border-primary/40 transition-colors">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black font-mono text-primary">{mission.id}</h3>
                <div className="text-xs font-mono font-bold text-gray-400 mt-0.5">{mission.date} · CQB SECTOR ALPHA</div>
              </div>
              <button className="bg-primary/20 hover:bg-primary/30 border border-primary/40 p-2.5 rounded-xl transition-colors text-primary shadow-sm">
                <Play size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 flex-1 font-mono text-base font-bold">
              <div className="flex items-center gap-2.5 bg-black/30 p-2.5 rounded-lg border border-white/5">
                <Clock size={16} className="text-gray-400" />
                <span className="text-white">{mission.duration}</span>
              </div>
              <div className="flex items-center gap-2.5 bg-black/30 p-2.5 rounded-lg border border-white/5">
                <Radio size={16} className="text-cyan-400" />
                <span className="text-cyan-300">{mission.nodes} NODES</span>
              </div>
              <div className="flex items-center gap-2.5 bg-black/30 p-2.5 rounded-lg border border-white/5">
                <Activity size={16} className="text-healthy" />
                <span className="text-healthy">{mission.pdr}% PDR</span>
              </div>
              <div className="flex items-center gap-2.5 bg-black/30 p-2.5 rounded-lg border border-white/5">
                <AlertTriangle size={16} className={mission.disconnects > 0 ? "text-amber-400" : "text-emerald-400"} />
                <span className={mission.disconnects > 0 ? "text-amber-300" : "text-emerald-400"}>{mission.disconnects} DROPS</span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between text-xs font-mono font-bold text-gray-300">
              <span>AVG RSSI: <strong className="text-primary">{mission.rssi} dBm</strong></span>
              <span>REROUTES: <strong className="text-secondary">{mission.changes}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
