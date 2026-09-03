'use client';

import React from 'react';
import { OperationalMode } from '../types/tactical';
import { Radio, ShieldAlert, Wifi, Activity, Play, Lock, Database } from 'lucide-react';

interface HeaderC2Props {
  mode: OperationalMode;
  setMode: (mode: OperationalMode) => void;
  wsConnected: boolean;
  jammerActive: boolean;
  systemSinrAvg: number;
  totalPacketsLogged: number;
  livePacketsCount: number;
}

export const HeaderC2: React.FC<HeaderC2Props> = ({
  mode,
  setMode,
  wsConnected,
  jammerActive,
  systemSinrAvg,
  totalPacketsLogged,
  livePacketsCount,
}) => {
  const [timeStr, setTimeStr] = React.useState('');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toISOString().replace('T', ' ').substring(0, 19) + ' Z');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-12 min-h-[48px] max-h-[48px] border-b border-tactical-border bg-tactical-surface px-3 flex flex-nowrap items-center justify-between gap-2 font-mono select-none shadow-none whitespace-nowrap overflow-hidden">
      {/* Left: Project Branding */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-tactical-panel border border-tactical-border px-2 py-1">
          <Radio className="w-3.5 h-3.5 text-tactical-cyan animate-pulse" />
          <span className="text-[11.5px] font-bold tracking-wider text-tactical-textBright">
            NSG CQB-MANET // C2
          </span>
          <span className="text-[9px] bg-red-100 text-red-700 border border-red-300 px-1 py-0.2 font-semibold">
            PS 26185
          </span>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 text-[10.5px] text-tactical-textMuted">
          <span>TANK-00 (0,0)</span>
          <span>|</span>
          <span className="text-tactical-amber font-semibold">GPS-DENIED</span>
        </div>
      </div>

      {/* Center: Fixed metrics area that never expands or forces a line break */}
      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
        <div className="flex items-center gap-1 bg-tactical-panel border border-tactical-border px-2.5 py-1">
          <Activity className="w-3 h-3 text-tactical-cyan" />
          <span className="text-tactical-textMuted text-[10.5px]">SINR:</span>
          <span className={`font-bold text-[11px] ${systemSinrAvg >= 14 ? 'text-tactical-cyan' : systemSinrAvg >= 8 ? 'text-tactical-amber' : 'text-tactical-crimson'}`}>
            {systemSinrAvg.toFixed(1)} dB
          </span>
        </div>

        {/* Dynamic status pill with fixed minimum layout footprint */}
        {mode === 'live' ? (
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 px-2 py-1 text-emerald-800 text-[10.5px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE HW ({livePacketsCount} PKTS)</span>
          </div>
        ) : jammerActive ? (
          <div className="flex items-center gap-1 bg-red-50 border border-red-300 px-2 py-1 text-tactical-crimson animate-pulse font-semibold text-[10.5px]">
            <ShieldAlert className="w-3 h-3" />
            <span>EW JAMMER ON</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 border border-slate-300 px-2 py-1 text-slate-700 text-[10.5px]">
            <span>DEMO SIMULATION</span>
          </div>
        )}

        <div className="hidden xl:flex items-center gap-1 text-tactical-textMuted text-[10px]">
          <Database className="w-3 h-3 text-tactical-textMuted" />
          <span>DATABASE: <strong className="text-tactical-textLight">{totalPacketsLogged}</strong></span>
        </div>
      </div>

      {/* Right: Fixed Mode Switcher & Status (Never jumps or changes width) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center bg-tactical-panel border border-tactical-border p-0.5">
          <button
            onClick={() => setMode('live')}
            className={`w-20 h-6 text-[11px] font-semibold flex items-center justify-center gap-1 transition-none select-none ${
              mode === 'live'
                ? 'bg-tactical-surface text-slate-900 border border-tactical-border font-bold'
                : 'text-tactical-textMuted hover:text-tactical-textBright border border-transparent'
            }`}
          >
            <Lock className="w-2.5 h-2.5 text-tactical-cyan" />
            <span>LIVE</span>
          </button>
          <button
            onClick={() => setMode('simulation')}
            className={`w-24 h-6 text-[11px] font-semibold flex items-center justify-center gap-1 transition-none select-none ${
              mode === 'simulation'
                ? 'bg-tactical-surface text-tactical-cyan border border-tactical-border font-bold'
                : 'text-tactical-textMuted hover:text-tactical-textBright border border-transparent'
            }`}
          >
            <Play className="w-2.5 h-2.5 text-tactical-cyan" />
            <span>SIMULATE</span>
          </button>
        </div>

        {/* WebSocket Status Indicator */}
        <div className="flex items-center gap-1 px-2 h-6 bg-tactical-panel border border-tactical-border text-xs">
          <Wifi className={`w-3 h-3 ${wsConnected ? 'text-tactical-green' : 'text-tactical-amber'}`} />
          <span className="text-[10px] text-tactical-textMuted">
            {wsConnected ? 'ONLINE' : mode === 'live' ? 'STANDBY' : 'ENGINE'}
          </span>
        </div>

        <div className="text-[10.5px] text-tactical-textMuted hidden 2xl:block">
          {timeStr}
        </div>
      </div>
    </header>
  );
};
