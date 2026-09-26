import { History, Play, Clock, Activity, Radio, AlertTriangle } from 'lucide-react';

const mockMissions = [
  { id: 'SIM-2026-001', date: '2026-09-24', duration: '08:42', nodes: 6, rssi: -69, pdr: 94.2, latency: 41, changes: 14, disconnects: 3 },
  { id: 'SIM-2026-002', date: '2026-09-24', duration: '12:15', nodes: 6, rssi: -72, pdr: 91.5, latency: 48, changes: 22, disconnects: 1 },
  { id: 'SIM-2026-003', date: '2026-09-23', duration: '05:30', nodes: 4, rssi: -55, pdr: 98.9, latency: 25, changes: 4, disconnects: 0 },
  { id: 'SIM-2026-004', date: '2026-09-22', duration: '15:00', nodes: 8, rssi: -81, pdr: 85.4, latency: 62, changes: 45, disconnects: 8 },
];

export default function MissionHistory() {
  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-8">
        <History className="text-secondary" size={24} />
        <h1 className="text-2xl font-bold tracking-widest">MISSION HISTORY</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockMissions.map(mission => (
          <div key={mission.id} className="glass-panel p-6 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold font-mono text-primary">{mission.id}</h3>
                <div className="text-xs text-gray-500">{mission.date}</div>
              </div>
              <button className="bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors text-white">
                <Play size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 flex-1">
              <div className="flex items-center gap-2 text-sm font-mono">
                <Clock size={14} className="text-gray-400" />
                <span>{mission.duration}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono">
                <Radio size={14} className="text-gray-400" />
                <span>{mission.nodes} NODES</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono">
                <Activity size={14} className="text-gray-400" />
                <span>{mission.pdr}% PDR</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono">
                <AlertTriangle size={14} className="text-gray-400" />
                <span>{mission.disconnects} DROPS</span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between text-xs font-mono text-gray-400">
              <span>AVG RSSI: {mission.rssi} dBm</span>
              <span>{mission.changes} ROUTE CHANGES</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
