'use client';

import React, { useState } from 'react';
import { TacticalNode } from '../types/tactical';
import { Radio, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface SectorBeamformingProps {
  selectedNode: TacticalNode | null;
  allNodes: TacticalNode[];
}

export const SectorBeamforming: React.FC<SectorBeamformingProps> = ({
  selectedNode,
  allNodes,
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const node = selectedNode || allNodes.find((n) => !n.isAnchor) || allNodes[0];
  if (!node) return null;

  const sectors = [
    { id: 1, name: 'NORTH (0°)', elements: 'P1+P2', angle: '-90deg', label: 'N' },
    { id: 2, name: 'EAST (90°)', elements: 'P2+P3', angle: '0deg', label: 'E' },
    { id: 3, name: 'SOUTH (180°)', elements: 'P3+P4', angle: '90deg', label: 'S' },
    { id: 4, name: 'WEST (270°)', elements: 'P4+P1', angle: '180deg', label: 'W' },
  ];

  return (
    <div className="bg-white/95 backdrop-blur border border-tactical-border font-mono text-xs select-none shadow-md w-72">
      {/* Header */}
      <div className="border-b border-tactical-border px-2.5 py-1.5 bg-slate-100/90 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-tactical-cyan" />
          <span className="font-bold text-[10.5px] text-slate-900 tracking-wider">
            BEAMFORMING ARRAY
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] bg-sky-50 border border-sky-200 text-tactical-cyan px-1.5 py-0.2 font-bold">
            {node.callsign}
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
        <div className="p-2.5 flex flex-col items-center gap-2">
          {/* Conformal Helmet Array Circle */}
          <div className="relative w-24 h-24 border-2 border-dashed border-slate-300 rounded-full flex items-center justify-center bg-slate-50">
            {/* AMC Metamaterial Shielding Inner Ring */}
            <div className="w-14 h-14 rounded-full border border-sky-300 bg-white flex flex-col items-center justify-center text-center p-0.5">
              <ShieldCheck className="w-3 h-3 text-tactical-cyan" />
              <span className="text-[6.5px] text-slate-800 font-bold leading-none">
                AMC METAMAT
              </span>
              <span className="text-[6px] text-sky-700 font-semibold leading-none">0.08W/kg</span>
            </div>

            {/* 4 Conformal Patch Sectors */}
            {sectors.map((sec) => {
              const isActive = node.activeSector === sec.id;
              return (
                <div
                  key={sec.id}
                  style={{
                    transform: `rotate(${sec.angle}) translate(34px) rotate(-${sec.angle})`,
                  }}
                  className={`absolute w-5 h-5 flex flex-col items-center justify-center border text-[8px] font-bold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 scale-110'
                      : 'bg-white text-slate-500 border-slate-300'
                  }`}
                >
                  {sec.label}
                </div>
              );
            })}
          </div>

          {/* Sector Telemetry Readout */}
          <div className="w-full bg-slate-50 border border-slate-200 p-1.5 space-y-0.5 text-[9px]">
            <div className="flex justify-between">
              <span className="text-slate-500">ACTIVE BEAM:</span>
              <strong className="text-slate-900">
                SEC-{node.activeSector} ({sectors[node.activeSector - 1]?.name})
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">DYNAMIC ELEMENTS:</span>
              <span className="text-slate-800 font-semibold">
                {sectors[node.activeSector - 1]?.elements} (PIN-DIODE)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
