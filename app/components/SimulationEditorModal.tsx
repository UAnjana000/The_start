'use client';

import React, { useState } from 'react';
import {
  TacticalNode,
  ObstacleWall,
  SimulationScenario,
  ScenarioKeyframe,
  NodeRole,
} from '../types/tactical';
import {
  X,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Upload,
  Camera,
  MapPin,
  Shield,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface SimulationEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: TacticalNode[];
  walls: ObstacleWall[];
  onUpdateNodes: (nodes: TacticalNode[]) => void;
  onUpdateWalls: (walls: ObstacleWall[]) => void;
  onApplyScenario?: (scenario: SimulationScenario) => void;
  simTime: number;
  onSeekSimTime?: (time: number) => void;
}

export const SimulationEditorModal: React.FC<SimulationEditorModalProps> = ({
  isOpen,
  onClose,
  nodes,
  walls,
  onUpdateNodes,
  onUpdateWalls,
  onApplyScenario,
  simTime,
  onSeekSimTime,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'keyframes' | 'json'>('editor');
  const [copied, setCopied] = useState(false);
  const [scenarioName, setScenarioName] = useState('CQB Ad-Hoc Mesh Scenario');
  const [durationSeconds, setDurationSeconds] = useState(15.0);

  // Keyframes store
  const [keyframes, setKeyframes] = useState<ScenarioKeyframe[]>([
    {
      id: 'kf-1',
      time: 0.0,
      phaseName: '01: 4 Nodes Baseline (2 with Tank, 2 to Bravo)',
      positions: {
        'CMD-01': { x: 3.5, y: 0.5 },
        'CMD-02': { x: 3.0, y: 2.5 },
        'CMD-03': { x: 7.0, y: 5.0 },
        'CMD-04': { x: 5.2, y: 2.0 },
      },
    },
    {
      id: 'kf-2',
      time: 4.0,
      phaseName: '02: Alpha moves towards wall -> RSSI drops',
      positions: {
        'CMD-01': { x: 6.8, y: 1.8 },
        'CMD-02': { x: 3.0, y: 2.5 },
        'CMD-03': { x: 7.0, y: 5.0 },
        'CMD-04': { x: 5.2, y: 2.0 },
      },
    },
    {
      id: 'kf-3',
      time: 8.0,
      phaseName: '03: Alpha moves behind wall -> Direct link cut (Red)',
      positions: {
        'CMD-01': { x: 12.0, y: 6.0 },
        'CMD-02': { x: 3.0, y: 2.5 },
        'CMD-03': { x: 7.0, y: 5.0 },
        'CMD-04': { x: 5.2, y: 2.0 },
      },
    },
    {
      id: 'kf-4',
      time: 11.0,
      phaseName: '04: Ad-hoc mesh reroutes around wall via Charlie',
      positions: {
        'CMD-01': { x: 12.0, y: 6.0 },
        'CMD-02': { x: 3.0, y: 2.5 },
        'CMD-03': { x: 7.0, y: 5.0 },
        'CMD-04': { x: 5.2, y: 2.0 },
      },
    },
  ]);

  // Add node form state
  const [newNodeCallsign, setNewNodeCallsign] = useState('');
  const [newNodeRole, setNewNodeRole] = useState<NodeRole>('pointman');
  const [newNodeX, setNewNodeX] = useState('5.0');
  const [newNodeY, setNewNodeY] = useState('2.0');

  // Add wall form state
  const [newWallId, setNewWallId] = useState(`WALL-0${walls.length + 1}`);
  const [newWallX1, setNewWallX1] = useState('8.0');
  const [newWallY1, setNewWallY1] = useState('-5.0');
  const [newWallX2, setNewWallX2] = useState('8.0');
  const [newWallY2, setNewWallY2] = useState('4.0');
  const [newWallAtten, setNewWallAtten] = useState('28.0');

  // Import JSON state
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Build the complete scenario JSON object
  const currentScenario: SimulationScenario = {
    scenarioName,
    durationSeconds,
    walls: walls.map((w) => ({
      id: w.id,
      x1: w.x1,
      y1: w.y1,
      x2: w.x2,
      y2: w.y2,
      attenuationDb: w.attenuationDb,
      thicknessMeters: w.thicknessMeters || 0.35,
      material: w.material || 'reinforced_concrete',
    })),
    initialNodes: nodes.map((n) => ({
      id: n.id,
      callsign: n.callsign,
      displayName: n.displayName || n.callsign,
      role: n.role,
      x: n.x,
      y: n.y,
      battery: n.battery,
      activeSector: n.activeSector || 1,
      txPowerDbm: n.txPowerDbm || 20.0,
      noiseFloorDbm: n.noiseFloorDbm || -95.0,
      isAnchor: n.isAnchor || false,
      hopCount: n.hopCount,
      nextHopId: n.nextHopId,
    })),
    keyframes,
  };

  const jsonString = JSON.stringify(currentScenario, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenarioName.toLowerCase().replace(/\s+/g, '_')}_scenario.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add new node
  const handleAddNode = () => {
    const nextNum = nodes.filter((n) => !n.isAnchor).length + 1;
    const callsign = newNodeCallsign.trim() || `CMD-0${nextNum}`;
    const id = `CMD-0${nextNum}`;
    const x = parseFloat(newNodeX) || 5.0;
    const y = parseFloat(newNodeY) || 2.0;

    const newNode: TacticalNode = {
      id,
      callsign,
      displayName: callsign,
      role: newNodeRole,
      x,
      y,
      battery: 92,
      activeSector: 2,
      txPowerDbm: 20.0,
      noiseFloorDbm: -95.0,
      hopCount: 1,
      nextHopId: 'TANK-00',
    };

    onUpdateNodes([...nodes, newNode]);
    setNewNodeCallsign('');
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'TANK-00') return; // Cannot delete base TOC
    onUpdateNodes(nodes.filter((n) => n.id !== nodeId));
  };

  // Add new wall
  const handleAddWall = () => {
    const wallId = newWallId.trim() || `WALL-0${walls.length + 1}`;
    const x1 = parseFloat(newWallX1) || 8.0;
    const y1 = parseFloat(newWallY1) || -5.0;
    const x2 = parseFloat(newWallX2) || 8.0;
    const y2 = parseFloat(newWallY2) || 4.0;
    const attenuationDb = parseFloat(newWallAtten) || 28.0;

    const newWall: ObstacleWall = {
      id: wallId,
      x1,
      y1,
      x2,
      y2,
      attenuationDb,
      thicknessMeters: 0.35,
      material: 'reinforced_concrete',
    };

    onUpdateWalls([...walls, newWall]);
    setNewWallId(`WALL-0${walls.length + 2}`);
  };

  // Delete wall
  const handleDeleteWall = (wallId: string) => {
    onUpdateWalls(walls.filter((w) => w.id !== wallId));
  };

  // Record current canvas positions as a keyframe
  const handleRecordKeyframe = () => {
    const currentPositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      if (!n.isAnchor) {
        currentPositions[n.id] = { x: n.x, y: n.y };
      }
    });

    const newKf: ScenarioKeyframe = {
      id: `kf-${Date.now()}`,
      time: parseFloat(simTime.toFixed(1)),
      phaseName: `Step at ${simTime.toFixed(1)}s (Positions Recorded)`,
      positions: currentPositions,
    };

    // Sort by time
    const updated = [...keyframes.filter((k) => Math.abs(k.time - simTime) > 0.3), newKf].sort(
      (a, b) => a.time - b.time
    );
    setKeyframes(updated);
  };

  // Jump canvas to keyframe positions
  const handleJumpToKeyframe = (kf: ScenarioKeyframe) => {
    if (onSeekSimTime) onSeekSimTime(kf.time);
    const updated = nodes.map((n) => {
      if (kf.positions[n.id]) {
        return { ...n, x: kf.positions[n.id].x, y: kf.positions[n.id].y };
      }
      return n;
    });
    onUpdateNodes(updated);
  };

  // Delete keyframe
  const handleDeleteKeyframe = (kfId: string) => {
    setKeyframes(keyframes.filter((k) => k.id !== kfId));
  };

  // Import JSON string
  const handleImportJson = () => {
    setImportError(null);
    try {
      const parsed: SimulationScenario = JSON.parse(importJsonText);
      if (!parsed.walls || !parsed.initialNodes) {
        throw new Error('Invalid schema: Scenario must have "walls" and "initialNodes" arrays.');
      }
      if (parsed.scenarioName) setScenarioName(parsed.scenarioName);
      if (parsed.durationSeconds) setDurationSeconds(parsed.durationSeconds);
      if (parsed.walls) onUpdateWalls(parsed.walls);
      if (parsed.initialNodes) onUpdateNodes(parsed.initialNodes);
      if (parsed.keyframes) setKeyframes(parsed.keyframes);

      if (onApplyScenario) onApplyScenario(parsed);
      setActiveTab('editor');
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse JSON');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 font-mono">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-tactical-cyan animate-pulse" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>SIMULATION SCENARIO BUILDER & RECORDER</span>
              <span className="text-[10px] text-sky-400 bg-sky-950 border border-sky-800 px-1.5 py-0.5 rounded">
                JSON EXPORT
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 bg-slate-950/60">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors border-b-2 ${
                activeTab === 'editor'
                  ? 'border-tactical-cyan text-tactical-cyan bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              1. NODES & WALLS ({nodes.length}N / {walls.length}W)
            </button>
            <button
              onClick={() => setActiveTab('keyframes')}
              className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors border-b-2 ${
                activeTab === 'keyframes'
                  ? 'border-tactical-cyan text-tactical-cyan bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              2. RECORD TRAJECTORY ({keyframes.length} STEPS)
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-4 py-2.5 text-xs font-bold uppercase transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'json'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>3. EXPORT / IMPORT JSON</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecordKeyframe}
              className="px-2.5 py-1 text-[11px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold uppercase rounded flex items-center gap-1 shadow"
              title="Record current canvas positions into timeline"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>REC POS ({simTime.toFixed(1)}s)</span>
            </button>
            <button
              onClick={handleCopyJson}
              className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase rounded flex items-center gap-1 shadow"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED!' : 'COPY JSON'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {/* TAB 1: NODES & WALLS EDITOR */}
          {activeTab === 'editor' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nodes List & Add Form */}
              <div className="flex flex-col gap-3 bg-slate-950/70 border border-slate-800 p-4 rounded">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200 uppercase flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-tactical-cyan" />
                    <span>OPERATIVE NODES ({nodes.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Drag dots on canvas to move</span>
                </div>

                {/* Node Items */}
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {nodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            node.isAnchor ? 'bg-tactical-cyan' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-bold text-white">{node.callsign}</span>
                        <span className="text-[10px] text-slate-400 uppercase">({node.role})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono text-[11px]">
                          ({node.x.toFixed(1)}, {node.y.toFixed(1)})m
                        </span>
                        {!node.isAnchor && (
                          <button
                            onClick={() => handleDeleteNode(node.id)}
                            className="text-red-400 hover:text-red-300 p-1 hover:bg-red-950/60 rounded"
                            title="Delete Node"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Node Form */}
                <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2">
                  <span className="font-bold text-slate-300 uppercase text-[11px]">+ Add New Node</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Callsign (e.g. ECHO-05)"
                      value={newNodeCallsign}
                      onChange={(e) => setNewNodeCallsign(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 placeholder-slate-500 rounded"
                    />
                    <select
                      value={newNodeRole}
                      onChange={(e) => setNewNodeRole(e.target.value as NodeRole)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded uppercase text-[11px]"
                    >
                      <option value="pointman">Pointman</option>
                      <option value="assault">Assault</option>
                      <option value="breacher">Relay / Breacher</option>
                      <option value="marksman">Scout / Marksman</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      placeholder="X (meters)"
                      value={newNodeX}
                      onChange={(e) => setNewNodeX(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded w-1/2"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Y (meters)"
                      value={newNodeY}
                      onChange={(e) => setNewNodeY(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded w-1/2"
                    />
                    <button
                      onClick={handleAddNode}
                      className="px-3 py-1 bg-tactical-cyan hover:bg-sky-500 text-slate-950 font-bold uppercase rounded flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Walls List & Add Form */}
              <div className="flex flex-col gap-3 bg-slate-950/70 border border-slate-800 p-4 rounded">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200 uppercase flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    <span>CONCRETE OBSTACLE WALLS ({walls.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Blocks direct LoS RF rays</span>
                </div>

                {/* Wall Items */}
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {walls.map((wall) => (
                    <div
                      key={wall.id}
                      className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded bg-red-500" />
                        <span className="font-bold text-white">{wall.id}</span>
                        <span className="text-[10px] text-amber-400 font-mono">
                          (-{wall.attenuationDb}dB)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono text-[10px]">
                          ({wall.x1}, {wall.y1}) ➔ ({wall.x2}, {wall.y2})
                        </span>
                        <button
                          onClick={() => handleDeleteWall(wall.id)}
                          className="text-red-400 hover:text-red-300 p-1 hover:bg-red-950/60 rounded"
                          title="Delete Wall"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Wall Form */}
                <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2">
                  <span className="font-bold text-slate-300 uppercase text-[11px]">+ Add Concrete Barrier</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Wall ID"
                      value={newWallId}
                      onChange={(e) => setNewWallId(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded"
                    />
                    <input
                      type="number"
                      step="1"
                      placeholder="Loss (dB)"
                      value={newWallAtten}
                      onChange={(e) => setNewWallAtten(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded col-span-2"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 items-center">
                    <input
                      type="number"
                      step="0.5"
                      placeholder="X1"
                      value={newWallX1}
                      onChange={(e) => setNewWallX1(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Y1"
                      value={newWallY1}
                      onChange={(e) => setNewWallY1(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="X2"
                      value={newWallX2}
                      onChange={(e) => setNewWallX2(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Y2"
                      value={newWallY2}
                      onChange={(e) => setNewWallY2(e.target.value)}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 rounded"
                    />
                  </div>
                  <button
                    onClick={handleAddWall}
                    className="w-full py-1 bg-red-600 hover:bg-red-500 text-white font-bold uppercase rounded flex items-center justify-center gap-1 shadow mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Concrete Wall</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RECORD TRAJECTORY & KEYFRAMES */}
          {activeTab === 'keyframes' && (
            <div className="flex flex-col gap-4">
              <div className="bg-sky-950/60 border border-sky-800/80 p-3 rounded flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sky-200 uppercase">How Position Recording Works:</h4>
                  <p className="text-[11px] text-sky-300 font-sans mt-0.5">
                    1. Close this modal and drag nodes on the canvas to their desired positions.
                    <br />
                    2. Click <strong>"REC POS"</strong> at the top to snapshot current positions at the selected timeline timestamp.
                    <br />
                    3. Click any step below to test and jump nodes to that recorded position.
                  </p>
                </div>
                <button
                  onClick={handleRecordKeyframe}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold uppercase rounded flex items-center gap-1.5 shadow shrink-0"
                >
                  <Camera className="w-4 h-4" />
                  <span>Record Keyframe Now</span>
                </button>
              </div>

              {/* Keyframe List */}
              <div className="flex flex-col gap-2">
                <span className="font-bold text-slate-300 uppercase">Recorded Scenario Keyframes ({keyframes.length})</span>
                <div className="flex flex-col gap-2">
                  {keyframes.map((kf, index) => (
                    <div
                      key={kf.id}
                      className="bg-slate-950/80 border border-slate-800 p-3 rounded flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded bg-slate-800 text-tactical-cyan flex items-center justify-center font-bold text-xs">
                          {index + 1}
                        </span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{kf.phaseName}</span>
                            <span className="text-[10px] bg-slate-800 text-sky-400 px-1.5 py-0.2 rounded font-mono">
                              {kf.time.toFixed(1)}s
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Positions: {Object.entries(kf.positions).map(([k, pos]) => `${k}: (${pos.x}, ${pos.y})`).join(' | ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleJumpToKeyframe(kf)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded flex items-center gap-1 border border-slate-700"
                        >
                          <Play className="w-3 h-3" />
                          <span>Jump To</span>
                        </button>
                        <button
                          onClick={() => handleDeleteKeyframe(kf.id)}
                          className="text-red-400 hover:text-red-300 p-1 hover:bg-red-950/60 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT / IMPORT JSON */}
          {activeTab === 'json' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 p-3 rounded">
                <div>
                  <h4 className="font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>READY TO SHARE SIMULATION JSON</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Copy this exact JSON and give it to the assistant in chat. It contains all nodes, walls, and recorded keyframe movements!
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyJson}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase rounded flex items-center gap-1.5 shadow text-xs tracking-wider"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'COPIED TO CLIPBOARD!' : 'COPY JSON TO CLIPBOARD'}</span>
                  </button>
                  <button
                    onClick={handleDownloadJson}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold uppercase rounded flex items-center gap-1 border border-slate-700"
                    title="Download .json file"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* JSON Code Box */}
              <div className="relative">
                <pre className="bg-slate-950 border border-slate-800 p-4 rounded text-[11px] text-emerald-300 font-mono overflow-x-auto max-h-72 select-all">
                  {jsonString}
                </pre>
              </div>

              {/* Import / Paste JSON Box */}
              <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
                <span className="font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-sky-400" />
                  <span>PASTE JSON TO LOAD / IMPORT SCENARIO</span>
                </span>
                <textarea
                  rows={4}
                  placeholder="Paste simulation scenario JSON here to load..."
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  className="bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200 font-mono rounded placeholder-slate-600"
                />
                {importError && (
                  <span className="text-red-400 text-[11px] font-bold">⚠️ Error: {importError}</span>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleImportJson}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase rounded flex items-center gap-1.5 shadow"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Load & Apply Scenario</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950 text-slate-400">
          <div className="flex items-center gap-3">
            <span>Nodes: {nodes.length}</span>
            <span>•</span>
            <span>Walls: {walls.length}</span>
            <span>•</span>
            <span>Keyframes: {keyframes.length}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase rounded transition-colors"
          >
            Close & View Canvas
          </button>
        </div>
      </div>
    </div>
  );
};
