import { Link, useLocation } from 'react-router-dom';
import { Activity, Radio, BarChart2, History, Map, BrainCircuit, Server, Video } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { path: '/', label: 'HOME', icon: <Activity size={18} /> },
  { path: '/video', label: 'VIDEO FEED', icon: <Video size={18} /> },
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
    <nav className="glass-panel rounded-none border-t-0 border-l-0 border-r-0 border-b border-white/15 sticky top-0 z-50 px-6 md:px-8 py-3.5 flex items-center justify-between shadow-xl">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0 shadow-md">
            <Radio size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="font-black text-base md:text-lg tracking-wider text-white">NSG TACTICAL MESH</h1>
            <div className="text-xs text-secondary tracking-widest uppercase font-mono font-bold">Command &amp; Control C4ISR</div>
          </div>
        </div>
        
        <div className="hidden lg:flex items-center gap-1.5">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold tracking-wider transition-colors",
                location.pathname === item.path 
                  ? "bg-primary/25 text-primary border border-primary/40 shadow-sm" 
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm font-mono font-bold">
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-emerald-400">
          <div className="w-2.5 h-2.5 rounded-full bg-healthy animate-ping"></div>
          <span>SYSTEM ONLINE</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
          <span className="text-gray-400">NODES:</span>
          <span className="text-white font-extrabold">6/6</span>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
          <span className="text-gray-400">MISSION:</span>
          <span className="text-secondary font-extrabold">SIM-2026-001</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
          <span className="text-gray-400">HEALTH:</span>
          <span className="text-healthy font-extrabold">98%</span>
        </div>
      </div>
    </nav>
  );
}
