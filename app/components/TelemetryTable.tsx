'use client';

import React from 'react';
import { TacticalNode, NodeLink, GhostNode, OperationalMode } from '../types/tactical';
import { Signal, Battery, Radio, GitCommit, ArrowRight } from 'lucide-react';

interface TelemetryTableProps {
  nodes: TacticalNode[];
  links: NodeLink[];
  ghostNodes: GhostNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  mode: OperationalMode;
}

export const TelemetryTable: React.FC<TelemetryTableProps> = ({
  nodes,
  links,
  ghostNodes,
  selectedNodeId,
  onSelectNode,
  mode,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-tactical-border font-mono text-xs overflow-hidden flex flex-col h-full select-none shadow-none">
      {/* Header */}
      <div className="border-b border-tactical-border px-3 py-2 bg-tactical-panel dark:bg-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Signal className="w-3.5 h-3.5 text-tactical-cyan" />
          <span className="font-bold tracking-wider text-tactical-textBright">
            {mode === 'live' ? 'LIVE ESP32 TELEMETRY' : 'TELEMETRY STREAM'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-tactical-textMuted font-semibold">
          <span className="bg-white dark:bg-slate-900 px-2 py-0.5 border border-tactical-border">
            PROTOCOL: B.A.T.M.A.N. ADV / OLSR
          </span>
          <span className="bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-2 py-0.5 font-bold">
            MULTI-HOP MESH
          </span>
        </div>
      </div>

      {/* Dense Monospace Grid Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-tactical-border bg-slate-50 text-[10px] text-tactical-textMuted uppercase tracking-wider font-bold">
              <th className="p-2">NODE ID</th>
              <th className="p-2">CALLSIGN</th>
              <th className="p-2">ROLE</th>
              <th className="p-2">POS (X, Y)</th>
              <th className="p-2">NEXT HOP</th>
              <th className="p-2">HOPS</th>
              <th className="p-2">LINK SINR</th>
              <th className="p-2">SECTOR</th>
              <th className="p-2">BATTERY</th>
              <th className="p-2">QoS VIDEO</th>
              <th className="p-2">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-tactical-border/50 text-[11px]">
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center text-tactical-textMuted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Radio className="w-5 h-5 text-slate-400 animate-pulse" />
                    <span>AWAITING LIVE ESP32 HARDWARE TELEMETRY PACKETS...</span>
                  </div>
                </td>
              </tr>
            ) : (
              nodes.map((node) => {
                const link = links.find((l) => l.fromId === node.id);
                const ghost = ghostNodes.find((g) => g.targetNodeId === node.id);
                const isSelected = selectedNodeId === node.id;

                const sinr = link ? link.sinrDb : 35.0;
                const videoBitrate = link ? link.videoBitrateKbps : 4500;
                const nextHop = node.nextHopId || 'TANK-00';
                const hops = node.hopCount ?? 1;

                let statusColor = 'text-slate-700';
                let statusText = 'HEALTHY';
                if (ghost || (link && (link.status === 'critical' || link.status === 'broken'))) {
                  statusColor = 'text-tactical-crimson font-bold';
                  statusText = 'HEALING GHOST';
                } else if (link && link.status === 'degraded') {
                  statusColor = 'text-tactical-amber font-bold';
                  statusText = 'DEGRADED';
                } else if (node.isAnchor) {
                  statusColor = 'text-slate-900 font-bold';
                  statusText = 'ANCHOR TOC';
                }

                return (
                  <tr
                    key={node.id}
                    onClick={() => onSelectNode(node.id)}
                    className={`hover:bg-slate-100/80 cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-50 border-l-2 border-slate-900' : ''
                    }`}
                  >
                    <td className="p-2 font-bold text-tactical-textBright">{node.id}</td>
                    <td className="p-2 text-slate-800 font-semibold">{node.callsign}</td>
                    <td className="p-2 text-slate-500 uppercase text-[10px]">{node.role}</td>
                    <td className="p-2 text-slate-700 font-mono">
                      ({node.x.toFixed(1)}, {node.y.toFixed(1)})
                    </td>
                    <td className="p-2">
                      <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
                        {node.isAnchor ? 'ROOT' : `➔ ${nextHop}`}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold border ${hops > 2 ? 'bg-amber-50 text-amber-800 border-amber-300' : hops === 2 ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-slate-100 text-slate-800 border-slate-300'}`}>
                        {node.isAnchor ? '0 HOPS' : `${hops} HOP${hops > 1 ? 'S' : ''}`}
                      </span>
                    </td>
                    <td className="p-2 font-bold">
                      <span
                        className={
                          sinr >= 14
                            ? 'text-slate-800'
                            : sinr >= 8
                            ? 'text-tactical-amber'
                            : 'text-tactical-crimson'
                        }
                      >
                        {sinr.toFixed(1)} dB
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-800 font-mono font-semibold">
                        SEC-{node.activeSector}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Battery
                          className={`w-3.5 h-3.5 ${
                            node.battery > 50
                              ? 'text-tactical-green'
                              : node.battery > 20
                              ? 'text-tactical-amber'
                              : 'text-tactical-crimson'
                          }`}
                        />
                        <span>{node.battery}%</span>
                      </div>
                    </td>
                    <td className="p-2">
                      {videoBitrate > 0 ? (
                        <span className="text-tactical-green font-mono font-semibold">{videoBitrate} kbps</span>
                      ) : (
                        <span className="text-tactical-crimson font-mono font-semibold">OFFLINE</span>
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`text-[10px] tracking-wider ${statusColor}`}>
                        {statusText}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Breadcrumb path footer */}
      <div className="border-t border-tactical-border px-3 py-1.5 bg-slate-50 text-[10px] text-tactical-textMuted flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">SELECTED MESH ROUTE:</span>
          {(() => {
            const current = nodes.find((n) => n.id === selectedNodeId) || nodes[1];
            if (!current) return <span>NONE</span>;
            const path = current.routePath || [current.id, 'TANK-00'];
            return (
              <div className="flex items-center gap-1 text-slate-800 font-bold">
                {path.map((step, idx) => (
                  <React.Fragment key={step}>
                    <span className="bg-white border border-slate-300 px-1.5 py-0.2">{step}</span>
                    {idx < path.length - 1 && <span className="text-sky-600">➔</span>}
                  </React.Fragment>
                ))}
              </div>
            );
          })()}
        </div>
        <span>MANET QoS: Command Telemetry &gt; Voice &gt; L-Band Video</span>
      </div>
    </div>
  );
};
