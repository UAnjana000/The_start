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
  Activity,
  Layers,
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
                  className={`relative border p-4.5 sm:p-5 flex flex-col justify-between gap-4 transition-all shadow-sm ${
                    isOffline
                      ? 'border-red-500/80 bg-red-50/25 dark:bg-red-950/25 ring-1 ring-red-500/40'
                      : isSelected
                      ? 'bg-white dark:bg-slate-900 border-tactical-cyan ring-2 ring-tactical-cyan/50'
                      : 'bg-white dark:bg-slate-900 border-tactical-border hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  {/* Top Bar: Role badge, Offline/Online Status Pill, ID & Hardware Device UID */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                          node.isAnchor || node.id === 'Gateway'
                            ? 'bg-slate-900 text-white'
                            : isOffline
                            ? 'bg-red-500/20 border-2 border-red-500 text-red-600'
                            : 'bg-sky-500/20 border-2 border-sky-500 text-sky-700 dark:text-sky-300'
                        }`}
                      >
                        {node.isAnchor || node.id === 'Gateway' ? <Shield className="w-4 h-4" /> : node.id.replace('Node ', 'N')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {node.id}
                          </span>
                          <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold border border-slate-300 dark:border-slate-700">
                            {node.deviceId || 'ESP32-S'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide">
                          ROLE: {node.role.replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill: Green if connected, Red with Last Alive Timer if lost */}
                    <div className="flex items-center gap-1.5">
                      {isOffline ? (
                        <span className="flex items-center gap-1.5 bg-red-100 dark:bg-red-950/90 text-red-700 dark:text-red-300 border border-red-400 dark:border-red-800 px-2.5 py-1 text-xs font-black animate-pulse">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                          OFFLINE // LAST ALIVE: 42s AGO
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700 px-2.5 py-1 text-xs font-black">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          {t.statusConnected}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Callsign / Display Name Editor */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">
                      {t.editDisplayName}
                    </span>
                    {editingNodeId === node.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-tactical-cyan text-slate-900 dark:text-white font-mono uppercase outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(node.id)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          title={t.save}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingNodeId(null)}
                          className="p-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 text-slate-800 dark:text-white rounded"
                          title={t.cancel}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2">
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
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
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Telemetry Metrics 3x2 Grid (Bigger Fonts, NIL values when Offline) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                        <Battery className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>HEALTH:</span>
                      </div>
                      <span className={`font-black text-xs sm:text-sm ${isOffline ? 'text-slate-400' : node.battery > 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                        {isOffline ? 'NIL (DISCONNECTED)' : `${node.battery}% (BATT)`}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                        <Radio className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>ANTENNA:</span>
                      </div>
                      <span className="font-black text-xs sm:text-sm text-sky-700 dark:text-sky-300 truncate">
                        {isOffline ? 'NIL (OFFLINE)' : `SEC #${node.activeSector}`}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                        <Signal className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>RADIO LINK:</span>
                      </div>
                      <span className={`font-black text-xs sm:text-sm ${isOffline ? 'text-red-500 font-extrabold animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isOffline ? 'RSSI: NIL (SEVERED)' : `RSSI: ${node.rssiDbm ?? -62.0} dBm`}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                        <Activity className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>PDR (PACKETS):</span>
                      </div>
                      <span className={`font-black text-xs sm:text-sm ${isOffline ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isOffline ? 'NIL (0.0% PDR)' : `${node.pdrPct ?? 99.2}% PDR`}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                        <MapPin className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>GPS POS:</span>
                      </div>
                      <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate" title={`${node.lat ?? 28.6139}°, ${node.lon ?? 77.2090}°`}>
                        {isOffline ? `LAST: (${node.lat ?? 28.6142}°, ${node.lon ?? 77.2095}°)` : `${node.lat ?? 28.6139}°, ${node.lon ?? 77.2090}°`}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
                        <Layers className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span>KINEMATICS:</span>
                      </div>
                      <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        {isOffline ? 'NIL (LOST)' : node.movementSpeedMs ? `${node.movementSpeedMs} m/s` : 'STATIC (0 m/s)'}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Hop Relay Breadcrumb */}
                  <div className={`p-3 text-xs sm:text-sm border font-bold ${
                    isOffline
                      ? 'bg-red-50/70 dark:bg-red-950/50 border-red-300 dark:border-red-800/70'
                      : 'bg-sky-50 dark:bg-slate-800/80 border-sky-200 dark:border-slate-700'
                  }`}>
                    <span className="text-slate-500 dark:text-slate-400 uppercase font-black mr-1">
                      MANET ROUTE:
                    </span>
                    {isOffline ? (
                      <span className="text-red-600 dark:text-red-400 font-black">
                        ⚠ SIGNAL SEVERED // LAST SEEN: 42s AGO (NIL TELEMETRY)
                      </span>
                    ) : (
                      <>
                        <span className="text-sky-800 dark:text-sky-300 font-black">
                          {node.routePath ? node.routePath.join(' ➔ ') : `${node.id} ➔ Gateway`}
                        </span>
                        {node.hopCount !== undefined && (
                          <span className="ml-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5">
                            {node.hopCount} HOPS
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* ML PREDICTIVE EARLY WARNING LAYER BANNER */}
                  {node.mlWarning && (
                    <div className="bg-amber-50 dark:bg-amber-950/70 border-2 border-amber-400 dark:border-amber-700 p-3.5 flex flex-col gap-1.5 text-amber-950 dark:text-amber-200 shadow-sm animate-pulse">
                      <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-amber-700 dark:text-amber-400 uppercase">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>ML PREDICTIVE EARLY WARNING ({node.mlRiskScore}% FAILURE PROBABILITY):</span>
                      </div>
                      <p className="text-xs sm:text-sm font-sans font-bold leading-relaxed text-amber-900 dark:text-amber-200">
                        {node.mlWarning}
                      </p>
                    </div>
                  )}

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
