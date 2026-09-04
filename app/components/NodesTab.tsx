'use client';

import React, { useState } from 'react';
import {
  TacticalNode,
  NodeLink,
  GhostNode,
  LanguageKey,
} from '../types/tactical';
import { translations } from '../utils/translations';
import {
  Server,
  Edit2,
  Trash2,
  RotateCcw,
  Wifi,
  WifiOff,
  Battery,
  Radio,
  Signal,
  MapPin,
  Check,
  X,
  Shield,
  AlertCircle,
} from 'lucide-react';

interface NodesTabProps {
  nodes: TacticalNode[];
  links: NodeLink[];
  ghostNodes: GhostNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateNodeName: (id: string, newCallsign: string) => void;
  onToggleHideNode: (id: string) => void;
  onToggleNodeConnection: (id: string) => void;
  onAddNode?: (newNode: TacticalNode) => void;
  language: LanguageKey;
}

export const NodesTab: React.FC<NodesTabProps> = ({
  nodes,
  links,
  ghostNodes,
  selectedNodeId,
  onSelectNode,
  onUpdateNodeName,
  onToggleHideNode,
  onToggleNodeConnection,
  language,
}) => {
  const t = translations[language];
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'hidden'>('active');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState<string>('');

  const activeNodes = nodes.filter((n) => !n.isHidden);
  const hiddenNodes = nodes.filter((n) => n.isHidden);

  const handleStartEdit = (node: TacticalNode) => {
    setEditingNodeId(node.id);
    setEditNameValue(node.displayName || node.callsign);
  };

  const handleSaveEdit = (id: string) => {
    if (editNameValue.trim()) {
      onUpdateNodeName(id, editNameValue.trim());
    }
    setEditingNodeId(null);
  };

  return (
    <div className="flex flex-col gap-5 max-w-[1600px] mx-auto w-full font-mono select-none pb-12">
      
      {/* Header & Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-tactical-cyan" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t.nodesTitle}
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-sans mt-1">
            {t.nodesSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub Tab Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('active')}
              className={`px-3 py-1.5 transition-colors ${
                activeSubTab === 'active'
                  ? 'bg-white dark:bg-slate-900 text-tactical-cyan font-bold border border-slate-300 dark:border-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.activeNodesTab} ({activeNodes.length})
            </button>
            <button
              onClick={() => setActiveSubTab('hidden')}
              className={`px-3 py-1.5 transition-colors ${
                activeSubTab === 'hidden'
                  ? 'bg-white dark:bg-slate-900 text-tactical-crimson font-bold border border-slate-300 dark:border-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.hiddenNodesTab} ({hiddenNodes.length})
            </button>
          </div>
        </div>
      </div>

      {/* Nodes Cards Grid */}
      {activeSubTab === 'active' ? (
        activeNodes.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-tactical-border p-12 text-center text-slate-500">
            No active nodes currently deployed.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeNodes.map((node) => {
              const link = links.find((l) => l.fromId === node.id);
              const ghost = ghostNodes.find((g) => g.targetNodeId === node.id);
              const isSelected = selectedNodeId === node.id;
              const isOffline = !!node.isOffline;
              const sinr = link ? link.sinrDb : 28.0;

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className={`relative border p-4 flex flex-col justify-between gap-4 transition-all shadow-sm ${
                    isOffline
                      ? 'border-red-500/70 bg-red-50/20 dark:bg-red-950/20 ring-1 ring-red-500/30'
                      : isSelected
                      ? 'bg-white dark:bg-slate-900 border-tactical-cyan ring-1 ring-tactical-cyan/40'
                      : 'bg-white dark:bg-slate-900 border-tactical-border hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  {/* Top Bar: Role badge, Offline/Online Status Pill, ID */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          node.isAnchor
                            ? 'bg-slate-900 text-white'
                            : isOffline
                            ? 'bg-red-500/20 border border-red-500 text-red-600'
                            : 'bg-sky-500/20 border border-sky-500 text-sky-700 dark:text-sky-300'
                        }`}
                      >
                        {node.isAnchor ? <Shield className="w-3.5 h-3.5" /> : node.id.replace('CMD-', 'C')}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                          {node.role.replace('_', ' ')}
                        </span>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {node.id}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill: Green if connected, Red if lost */}
                    <div className="flex items-center gap-1.5">
                      {isOffline ? (
                        <span className="flex items-center gap-1 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 px-2 py-0.5 text-[10px] font-bold animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-red-600" />
                          OFFLINE // FAR OBSTACLE OCCLUSION
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {t.statusConnected}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Callsign / Display Name Editor */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      {t.editDisplayName}
                    </span>
                    {editingNodeId === node.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-tactical-cyan text-slate-900 dark:text-white font-mono uppercase outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(node.id)}
                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          title={t.save}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingNodeId(null)}
                          className="p-1 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 text-slate-800 dark:text-white rounded"
                          title={t.cancel}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {node.displayName || node.callsign}
                        </span>
                        {!node.isAnchor && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(node);
                            }}
                            className="text-slate-500 hover:text-tactical-cyan p-0.5"
                            title="Edit Callsign"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Telemetry Metrics 2x2 Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[10.5px]">
                        <Battery className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>{t.batteryLevel}:</span>
                      </div>
                      <span
                        className={`font-bold text-[11px] ${
                          node.battery > 50
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600'
                        }`}
                      >
                        {node.battery}%
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[10.5px]">
                        <Radio className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>{t.activeBeamSector}:</span>
                      </div>
                      <span className="font-bold text-[11px] text-sky-700 dark:text-sky-300">
                        {isOffline ? 'SECTOR SCANNING' : `SEC #${node.activeSector}`}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[10.5px]">
                        <Signal className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>{t.signalSinr}:</span>
                      </div>
                      <span
                        className={`font-bold text-[11px] ${
                          isOffline
                            ? 'text-red-500 font-extrabold animate-pulse'
                            : sinr >= 14
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600'
                        }`}
                      >
                        {isOffline ? '0.0 dB (BROKEN)' : `${sinr} dB`}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[10.5px]">
                        <MapPin className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>COORDS:</span>
                      </div>
                      <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                        ({node.x}m, {node.y}m)
                      </span>
                    </div>
                  </div>

                  {/* Multi-Hop Relay Breadcrumb */}
                  <div className={`p-2 text-[10.5px] border ${
                    isOffline
                      ? 'bg-red-50/60 dark:bg-red-950/40 border-red-300 dark:border-red-800/60'
                      : 'bg-sky-50 dark:bg-slate-800/80 border-sky-200 dark:border-slate-700'
                  }`}>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      MANET ROUTE:{' '}
                    </span>
                    {isOffline ? (
                      <span className="text-red-600 dark:text-red-400 font-bold">
                        ⚠ SIGNAL SEVERED // FAR WALL OCCLUSION (0.0 kB/s)
                      </span>
                    ) : (
                      <>
                        <span className="text-sky-800 dark:text-sky-300 font-bold">
                          {node.routePath ? node.routePath.join(' ➔ ') : `${node.id} ➔ TANK-00`}
                        </span>
                        {node.hopCount !== undefined && (
                          <span className="ml-2 text-[9.5px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-1 py-0.2">
                            {node.hopCount} HOPS
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Ghost Node Waypoint Indicator */}
                  {ghost && (
                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 p-2 text-[10px] text-red-800 dark:text-red-300 flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                      <span>
                        AI HEALING: Shift {ghost.shiftCardinal} (+{ghost.predictedSinrGainDb}dB)
                      </span>
                    </div>
                  )}

                  {/* Action Buttons: Simulate Disconnect (Red Circle Trigger) & Delete/Hide */}
                  {!node.isAnchor && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleNodeConnection(node.id);
                        }}
                        className={`flex-1 py-1.5 text-[10.5px] font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                          isOffline
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                            : 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                        }`}
                      >
                        {isOffline ? (
                          <>
                            <Wifi className="w-3 h-3" />
                            <span>{t.simulateReconnect}</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="w-3 h-3" />
                            <span>{t.simulateDisconnect}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleHideNode(node.id);
                        }}
                        title={t.hideDeleteNode}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-950/60 hover:text-red-600 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Hidden / Deleted Nodes Tab */
        hiddenNodes.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-tactical-border p-12 text-center text-slate-500">
            No deleted or hidden nodes. All squad nodes are active in the mesh.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hiddenNodes.map((node) => (
              <div
                key={node.id}
                className="bg-white dark:bg-slate-900 border border-dashed border-red-300 dark:border-red-800 p-4 flex flex-col justify-between gap-3 opacity-80"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                      [TERMINATED / HIDDEN]
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {node.displayName || node.callsign}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{node.id}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Node is currently soft-deleted and removed from the active tactical canvas and routing table.
                </p>
                <button
                  onClick={() => onToggleHideNode(node.id)}
                  className="w-full py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-tactical-cyan hover:text-white text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.restoreNode}</span>
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
