'use client';

import React, { useState } from 'react';
import { JammerState, OperationalMode } from '../types/tactical';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

interface JammerControlProps {
  jammer: JammerState;
  onUpdateJammer: (jammer: JammerState) => void;
  mode: OperationalMode;
}

export const JammerControl: React.FC<JammerControlProps> = ({
  jammer,
  onUpdateJammer,
  mode,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  // Strictly only available in demo / simulation mode
  if (mode === 'live') return null;

  return (
    <div className="bg-white/95 backdrop-blur border border-tactical-border font-mono text-xs select-none shadow-md w-72">
      {/* Header */}
      <div className="border-b border-tactical-border px-2.5 py-1.5 bg-slate-100/90 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldAlert
            className={`w-3.5 h-3.5 ${
              jammer.active ? 'text-tactical-crimson animate-pulse' : 'text-tactical-textMuted'
            }`}
          />
          <span className="font-bold text-[10.5px] text-slate-900 tracking-wider">
            EW RF JAMMER
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] bg-red-100 border border-red-300 text-red-700 px-1 py-0.2 font-bold">
            DEMO
          </span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-500 hover:text-slate-900"
          >
            {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-2.5 flex flex-col gap-2">
          {/* Toggle Button */}
          <div className="flex items-center justify-between">
            <span className="text-slate-600 text-[10px] font-semibold">NOISE INJECTION:</span>
            <button
              onClick={() => onUpdateJammer({ ...jammer, active: !jammer.active })}
              className={`px-2.5 py-0.5 text-[10px] font-bold border transition-colors ${
                jammer.active
                  ? 'bg-tactical-crimson text-white border-red-600'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {jammer.active ? 'JAMMER ON' : 'STANDBY (OFF)'}
            </button>
          </div>

          {/* Noise Slider */}
          <div className="bg-slate-50 border border-slate-200 p-2 space-y-1">
            <div className="flex justify-between items-center text-[9.5px]">
              <span className="text-slate-600 font-semibold">NOISE FLOOR ($N$):</span>
              <strong className="text-tactical-crimson font-bold text-[10.5px]">
                +{jammer.noiseModifierDb} dB
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              disabled={!jammer.active}
              value={jammer.noiseModifierDb}
              onChange={(e) =>
                onUpdateJammer({ ...jammer, noiseModifierDb: parseInt(e.target.value, 10) })
              }
              className="w-full accent-tactical-crimson cursor-pointer disabled:opacity-30 h-1 bg-slate-300"
            />
            <div className="flex justify-between text-[7.5px] text-slate-500 font-medium">
              <span>0dB (CLEAN)</span>
              <span>+20dB (BASEMENT)</span>
              <span>+40dB (HOSTILE EW)</span>
            </div>
          </div>

          {/* Sector Target Buttons */}
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: 'global', label: 'GLOBAL' },
              { id: 'sector_north', label: 'SEC NORTH' },
              { id: 'sector_south', label: 'SEC SOUTH' },
              { id: 'deep_basement', label: 'BASEMENT' },
            ].map((zone) => (
              <button
                key={zone.id}
                onClick={() =>
                  onUpdateJammer({ ...jammer, targetZone: zone.id as JammerState['targetZone'] })
                }
                className={`py-1 px-1 text-[8.5px] border text-center font-bold transition-colors ${
                  jammer.targetZone === zone.id
                    ? 'bg-red-50 border-tactical-crimson text-tactical-crimson'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {zone.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
