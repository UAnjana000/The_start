import { Link, useLocation } from 'react-router-dom';
import { Activity, Radio, BarChart2, History, Map, BrainCircuit, Server } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { path: '/', label: 'HOME', icon: <Activity size={18} /> },
  { path: '/simulation', label: 'LIVE SIMULATION', icon: <Radio size={18} /> },
  { path: '/analytics', label: 'NODE ANALYTICS', icon: <BarChart2 size={18} /> },
  { path: '/history', label: 'MISSION HISTORY', icon: <History size={18} /> },
  { path: '/map', label: 'GPS MAP', icon: <Map size={18} /> },
  { path: '/ai', label: 'AI ANALYTICS', icon: <BrainCircuit size={18} /> },
  { path: '/status', label: 'SYSTEM STATUS', icon: <Server size={18} /> },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="glass-panel rounded-none border-t-0 border-l-0 border-r-0 border-b-white/10 sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Radio size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wider text-white">NSG TACTICAL MESH</h1>
            <div className="text-[10px] text-secondary tracking-widest uppercase">Command & Control</div>
          </div>
        </div>
        
        <div className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors",
                location.pathname === item.path 
                  ? "bg-primary/20 text-primary" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-healthy animate-pulse"></div>
          <span className="text-gray-300">SYSTEM ONLINE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">NODES:</span>
          <span className="text-white font-bold">6/6</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">MISSION:</span>
          <span className="text-secondary font-bold">SIM-2026-001</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">HEALTH:</span>
          <span className="text-healthy font-bold">98%</span>
        </div>
      </div>
    </nav>
  );
}
