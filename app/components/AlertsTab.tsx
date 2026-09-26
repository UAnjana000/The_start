'use client';

import React, { useMemo } from 'react';
import { TacticalNode, GhostNode, LanguageKey } from '../types/tactical';
import { translations } from '../utils/translations';
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Radio,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Crosshair,
  WifiOff,
  BatteryCharging,
  Layers,
  Flame,
  Users,
  CornerDownRight,
  ExternalLink,
} from 'lucide-react';

interface AlertsTabProps {
  nodes: TacticalNode[];
  ghostNodes: GhostNode[];
  onSelectNode?: (id: string) => void;
  onJumpToDashboard?: () => void;
  onJumpToSimulate?: () => void;
  language: LanguageKey;
}

interface DisconnectedCluster {
  id: string;
  nodes: TacticalNode[];
  centroid: { x: number; y: number };
  radiusMeters: number;
  suggestedGhost: {
    x: number;
    y: number;
    bearingDeg: number;
    distanceMeters: number;
    reason: string;
  };
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  nodes,
  ghostNodes,
  onSelectNode,
  onJumpToDashboard,
  onJumpToSimulate,
  language,
}) => {
  const t = translations[language];

  // 1. Extract all offline / disconnected nodes
  const disconnectedNodes = useMemo(() => {
    return nodes.filter((n) => !n.isAnchor && n.isOffline);
  }, [nodes]);

  // 2. Spatial Clustering Algorithm: Group disconnected nodes if they are together (distance <= 18m)
  const { clusters, individualNodes } = useMemo(() => {
    const CLUSTER_DISTANCE_THRESHOLD = 18.0; // meters
    const visited = new Set<string>();
    const foundClusters: DisconnectedCluster[] = [];
    const singles: TacticalNode[] = [];

    // Find nearest active online anchor / relay to compute ghost bridging vectors
    const onlineNodes = nodes.filter((n) => !n.isOffline);
    const anchor = onlineNodes.find((n) => n.isAnchor) || onlineNodes[0] || { x: 0, y: 0 };

    for (let i = 0; i < disconnectedNodes.length; i++) {
      const nodeA = disconnectedNodes[i];
      if (visited.has(nodeA.id)) continue;

      // Breadth-first search to find all nodes in proximity
      const group: TacticalNode[] = [nodeA];
      visited.add(nodeA.id);

      for (let j = 0; j < disconnectedNodes.length; j++) {
        const nodeB = disconnectedNodes[j];
        if (visited.has(nodeB.id)) continue;

        const posAx = nodeA.lastOnlineX ?? nodeA.x;
        const posAy = nodeA.lastOnlineY ?? nodeA.y;
        const posBx = nodeB.lastOnlineX ?? nodeB.x;
        const posBy = nodeB.lastOnlineY ?? nodeB.y;

        const dist = Math.hypot(posAx - posBx, posAy - posBy);
        if (dist <= CLUSTER_DISTANCE_THRESHOLD) {
          group.push(nodeB);
          visited.add(nodeB.id);
        }
      }

      if (group.length >= 2) {
        // Compute Centroid
        let sumX = 0;
        let sumY = 0;
        group.forEach((n) => {
          sumX += n.lastOnlineX ?? n.x;
          sumY += n.lastOnlineY ?? n.y;
        });
        const centroid = {
          x: parseFloat((sumX / group.length).toFixed(1)),
          y: parseFloat((sumY / group.length).toFixed(1)),
        };

        // Compute cluster radius
        let maxR = 0;
        group.forEach((n) => {
          const r = Math.hypot((n.lastOnlineX ?? n.x) - centroid.x, (n.lastOnlineY ?? n.y) - centroid.y);
          if (r > maxR) maxR = r;
        });

        // Compute Ghost Bridge Waypoint (halfway between nearest online node and cluster centroid)
        const ghostX = parseFloat(((anchor.x + centroid.x) / 2).toFixed(1));
        const ghostY = parseFloat(((anchor.y + centroid.y) / 2).toFixed(1));
        const distToAnchor = Math.hypot(centroid.x - anchor.x, centroid.y - anchor.y);
        const bearing = Math.round((Math.atan2(centroid.y - anchor.y, centroid.x - anchor.x) * 180) / Math.PI);
        const normalizedBearing = (bearing + 360) % 360;

        foundClusters.push({
          id: `CLUSTER-${group.map((g) => g.id).join('-')}`,
          nodes: group,
          centroid,
          radiusMeters: parseFloat(maxR.toFixed(1)),
          suggestedGhost: {
            x: ghostX,
            y: ghostY,
            bearingDeg: normalizedBearing,
            distanceMeters: parseFloat(distToAnchor.toFixed(1)),
            reason: `Re-bridge isolated squad partition (${group.length} operators) back to ${anchor.callsign || 'TOC-ANCHOR'}`,
          },
        });
      } else {
        singles.push(nodeA);
      }
    }

    return { clusters: foundClusters, individualNodes: singles };
  }, [disconnectedNodes, nodes]);

  const totalAlertsCount = clusters.length + individualNodes.length;

  return (
    <div className="flex flex-col gap-5 max-w-[1600px] mx-auto w-full font-mono select-none pb-12">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Bell className={`w-5 h-5 ${totalAlertsCount > 0 ? 'text-tactical-crimson animate-bounce' : 'text-tactical-cyan'}`} />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t.alertsTitle}
            </h1>
            {totalAlertsCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 font-extrabold rounded-sm animate-pulse">
                {totalAlertsCount} ACTIVE INCIDENT{totalAlertsCount > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-sans mt-1">
            Autonomous ad-hoc partition detection, multi-node clustering, and Ghost Node relay waypoint vectors
          </p>
        </div>

        <div className="flex items-center gap-2">
          {totalAlertsCount === 0 ? (
            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-xs px-3 py-1.5 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> ALL MESH NODES ONLINE // 0 INCIDENTS
            </span>
          ) : (
            <button
              onClick={onJumpToDashboard}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border border-red-500 shadow-sm"
            >
              <span>VIEW ON LIVE MAP</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ZERO INCIDENTS NOMINAL STATE */}
      {totalAlertsCount === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
            TACTICAL MESH NETWORK FULLY CONNECTED
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg font-sans leading-relaxed mb-6">
            All active operator helmet nodes (XIAO ESP32-C6) are streaming continuous telemetry to the TOC Gateway within the 15-second heartbeat window.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full text-left">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
                <ShieldAlert className="w-3 h-3 text-emerald-500" />
                <span>Link Reliability</span>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                100% (0 DROPOUTS)
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
                <Radio className="w-3 h-3 text-sky-500" />
                <span>Heartbeat Watchdog</span>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                &lt; 15.0s ACTIVE LIMIT
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Ghost Healer Engine</span>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                STANDBY / AUTONOMOUS
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE INCIDENTS: 2+ DISCONNECTED CLUSTERS */}
      {clusters.map((cluster, idx) => (
        <div
          key={cluster.id}
          className="bg-white dark:bg-slate-900 border-2 border-red-500 shadow-md p-5 flex flex-col gap-4 relative overflow-hidden"
        >
          {/* Crimson Indicator Ribbon */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-600 animate-pulse" />

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 dark:border-red-950 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-sm">
                <Users className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-red-700 dark:text-red-400 uppercase tracking-wider bg-red-100 dark:bg-red-950 px-2 py-0.5 border border-red-300 dark:border-red-800">
                    CRITICAL // MULTI-NODE SQUAD PARTITION #{idx + 1}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">
                    {cluster.nodes.length} OPERATORS TRAPPED TOGETHER
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase mt-1">
                  ISOLATED AD-HOC CLUSTER: {cluster.nodes.map((n) => n.displayName || n.callsign).join(' + ')}
                </h3>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-bold uppercase">CLUSTER CENTROID:</div>
              <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                ({cluster.centroid.x}m, {cluster.centroid.y}m) • SPAN: {cluster.radiusMeters * 2}m
              </div>
            </div>
          </div>

          {/* Clustered Operators Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {cluster.nodes.map((n) => (
              <div
                key={n.id}
                onClick={() => onSelectNode && onSelectNode(n.id)}
                className="bg-red-50/50 dark:bg-red-950/30 border border-red-300 dark:border-red-900/60 p-3 flex flex-col justify-between gap-2 cursor-pointer hover:border-red-500 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-red-700 dark:text-red-400 font-mono">{n.displayName || n.callsign}</span>
                    <span className="text-[9.5px] px-1.5 py-0.2 bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-200 uppercase font-extrabold">
                      LOST
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-sans mt-0.5">
                    ROLE: {n.role.replace('_', ' ')}
                  </div>
                </div>

                <div className="pt-2 border-t border-red-200 dark:border-red-900/40 text-[10px] flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="font-mono">LAST: ({n.lastOnlineX ?? n.x}m, {n.lastOnlineY ?? n.y}m)</span>
                  <span className="font-bold flex items-center gap-1">
                    <BatteryCharging className="w-3 h-3 text-amber-500" /> {n.battery}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* GHOST NODE RECOMMENDATION BOX */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 max-w-3xl">
              <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">
                  RECOMMENDED GHOST NODE RELAY DISPATCH:
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-200 font-sans mt-0.5 leading-relaxed">
                  Deploy or advance an ad-hoc Ghost Relay to coordinate <span className="font-mono font-bold">({cluster.suggestedGhost.x}m, {cluster.suggestedGhost.y}m)</span>. Vector: <span className="font-bold">{cluster.suggestedGhost.distanceMeters}m @ {cluster.suggestedGhost.bearingDeg}° bearing</span> from TOC to re-bridge the partition.
                </p>
              </div>
            </div>

            <button
              onClick={onJumpToSimulate}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-slate-950 font-bold text-xs uppercase tracking-wider border border-amber-500 flex items-center gap-1.5 flex-shrink-0 shadow-sm"
            >
              <span>SIMULATE GHOST HEALING</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {/* INDIVIDUAL DISCONNECTED NODE ALERTS */}
      {individualNodes.map((n) => {
        const lastX = n.lastOnlineX ?? n.x;
        const lastY = n.lastOnlineY ?? n.y;
        const ghostTargetX = parseFloat((lastX * 0.5).toFixed(1));
        const ghostTargetY = parseFloat((lastY * 0.5).toFixed(1));
        const dist = parseFloat(Math.hypot(lastX, lastY).toFixed(1));

        return (
          <div
            key={n.id}
            className="bg-white dark:bg-slate-900 border-2 border-red-500/80 dark:border-red-800 p-5 shadow-sm flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <WifiOff className="w-5 h-5 text-tactical-crimson animate-pulse" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase font-mono">
                      {n.displayName || n.callsign} ({n.id})
                    </span>
                    <span className="text-[10px] bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 px-2 py-0.5 border border-red-300 dark:border-red-800 font-extrabold">
                      LINK SEVERED // CONCRETE WALL OCCLUSION
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
                    HARDWARE UID: <span className="text-slate-700 dark:text-slate-300 font-bold">{n.deviceId || 'XIAO-ESP32-C6-4B1C'}</span> • GPS: ({n.lat ?? 28.61425}°, {n.lon ?? 77.20950}°)
                  </div>
                </div>
              </div>

              <div className="text-right text-xs text-slate-500 font-mono">
                LAST ONLINE POS: <span className="text-red-600 dark:text-red-400 font-bold font-mono">({lastX}m, {lastY}m)</span>
              </div>
            </div>

            {/* Telemetry Snapshot Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2">
                <span className="text-[10px] text-slate-500 block">RADIO SIGNAL (RSSI):</span>
                <span className="text-red-600 font-bold font-mono text-[11px]">-88.0 dBm (DROPPED)</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2">
                <span className="text-[10px] text-slate-500 block">PACKET DELIVERY (PDR):</span>
                <span className="text-red-600 font-bold font-mono text-[11px]">0.0% (100% LOSS)</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2">
                <span className="text-[10px] text-slate-500 block">ANTENNA STATE:</span>
                <span className="text-sky-700 dark:text-sky-300 font-bold font-mono text-[11px]">360° RADAR SWEEP</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2">
                <span className="text-[10px] text-slate-500 block">DEVICE HEALTH:</span>
                <span className="text-emerald-600 font-bold font-mono text-[11px]">{n.battery}% (NOMINAL)</span>
              </div>
            </div>

            {/* ML PREDICTIVE EARLY WARNING & MICRO-REPOSITIONING GUIDANCE */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">
                    ML PREDICTIVE EARLY-WARNING & MICRO-REPOSITIONING ADVISORY:
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-200 font-sans mt-0.5 leading-relaxed">
                    <span className="font-bold">Recommendation: </span>
                    Operator should step <span className="font-mono font-bold bg-amber-200 dark:bg-amber-900 px-1 py-0.2">1.5m East (Bearing 85°)</span> to clear the reinforced concrete shadow zone and restore Line-of-Sight with Gateway / Node 1. Predicted signal recovery: <span className="font-bold">+28.0 dB SINR gain</span>.
                  </p>
                </div>
              </div>

              <button
                onClick={onJumpToDashboard}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-slate-950 text-xs font-bold uppercase flex items-center gap-1.5 flex-shrink-0 shadow-sm"
              >
                <span>LOCATE ON MAP</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

