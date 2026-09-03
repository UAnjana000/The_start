'use client';

import React from 'react';
import { LanguageKey } from '../types/tactical';
import { translations } from '../utils/translations';
import { DataFlowDiagram } from './DataFlowDiagram';
import {
  Radio,
  Shield,
  Layers,
  Cpu,
  Zap,
  LayoutDashboard,
  GitBranch,
  Target,
  ArrowRight,
  Database,
  Wifi,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

interface HomeTabProps {
  onLaunchDashboard: () => void;
  language: LanguageKey;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  onLaunchDashboard,
  language,
}) => {
  const t = translations[language];

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full font-mono select-none pb-12">
      
      {/* Hero Header Section */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-tactical-border p-6 md:p-8 shadow-sm">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden xl:flex items-center justify-center opacity-15 pointer-events-none">
          <Radio className="w-72 h-72 text-tactical-cyan" />
        </div>

        <div className="relative z-10 flex flex-col gap-3 max-w-4xl">
          <div className="flex items-center gap-2">
            <span className="bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700 text-xs px-2.5 py-0.5 font-bold">
              SMART INDIA HACKATHON // PROBLEM STATEMENT 26185
            </span>
            <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs px-2 py-0.5 font-bold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> NSG MIL-SPEC READY
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            {t.projectTitle}
          </h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
            {t.projectSubtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              onClick={onLaunchDashboard}
              className="px-6 py-3 bg-tactical-cyan hover:bg-sky-700 text-white font-bold text-sm tracking-wider flex items-center gap-2 border border-sky-600 shadow-md transition-all hover:scale-[1.02] active:scale-95"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{t.launchConsole}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-2 border border-slate-300 dark:border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>FOUNDRY ONTOLOGY V4.2 ACTIVE // 4-SECTOR CONFORMAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Problem Statement Section */}
      <div className="bg-white dark:bg-slate-900 border border-tactical-border p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <Target className="w-4 h-4 text-tactical-crimson" />
          <h2 className="text-sm font-bold tracking-wider text-slate-900 dark:text-white uppercase">
            {t.problemStatement}
          </h2>
        </div>
        <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
          {t.problemDesc}
        </p>
      </div>

      {/* Key Architectural Innovations (4-Grid Foundry Spec) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-tactical-cyan" />
            <h2 className="text-sm font-bold tracking-wider text-slate-900 dark:text-white uppercase">
              {t.keyInnovations}
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            METRICS: 1.42 GHz L-BAND / 4-SECTOR / &lt;0.08 W/kg SAR
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col justify-between gap-3 shadow-sm hover:border-tactical-cyan transition-colors">
            <div>
              <div className="w-8 h-8 rounded bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-tactical-cyan mb-3">
                <Radio className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase mb-2">
                {t.innovation1Title}
              </h3>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                {t.innovation1Desc}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-sky-700 dark:text-sky-400 font-bold">
              GAIN: +6.8 dBi // 360° COVERAGE
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col justify-between gap-3 shadow-sm hover:border-tactical-cyan transition-colors">
            <div>
              <div className="w-8 h-8 rounded bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 mb-3">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase mb-2">
                {t.innovation2Title}
              </h3>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                {t.innovation2Desc}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-amber-700 dark:text-amber-400 font-bold">
              SAR: 0.076 W/kg (95% REDUCTION)
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col justify-between gap-3 shadow-sm hover:border-tactical-cyan transition-colors">
            <div>
              <div className="w-8 h-8 rounded bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mb-3">
                <GitBranch className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase mb-2">
                {t.innovation3Title}
              </h3>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                {t.innovation3Desc}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
              LATENCY: &lt;18ms / 4-HOP RELAY
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col justify-between gap-3 shadow-sm hover:border-tactical-cyan transition-colors">
            <div>
              <div className="w-8 h-8 rounded bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 mb-3">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase mb-2">
                {t.innovation4Title}
              </h3>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                {t.innovation4Desc}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-rose-700 dark:text-rose-400 font-bold">
              SINR RECOVERY: +12.4 dB PREDICTED
            </div>
          </div>
        </div>
      </div>

      {/* UML Architecture of Project Section (CQB Tactical Mesh Data Pipeline) */}
      <div className="bg-white dark:bg-slate-900 border border-tactical-border p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-tactical-cyan" />
            <h2 className="text-sm font-bold tracking-wider text-slate-900 dark:text-white uppercase">
              {t.umlArchitecture}
            </h2>
          </div>
          <button
            onClick={onLaunchDashboard}
            className="text-xs text-tactical-cyan hover:underline font-bold flex items-center gap-1"
          >
            <span>{t.viewDashboard}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Embedded Interactive UML Data Flow */}
        <DataFlowDiagram />

        {/* Component Specification Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-tactical-cyan font-bold uppercase mb-1">1. XIAO ESP32-C6 EDGE HARDWARE</div>
            <div className="text-slate-600 dark:text-slate-400 text-[11px] font-sans">
              Dual RF switches: Internal switch (GPIO 3/14) routes to external u.FL, driving external AS179-92LF SPDT (Pin 4/5 / D4/D5) for dynamic antenna beam diversity. Broadcasts 32-byte binary <code className="text-sky-600 dark:text-sky-400 font-mono font-bold">MeshPacket</code> structures over ESP-NOW.
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-tactical-amber font-bold uppercase mb-1">2. GATEWAY &amp; FIREBASE RTDB INGRESS</div>
            <div className="text-slate-600 dark:text-slate-400 text-[11px] font-sans">
              ESP32 WROOM-32 sink aggregates multi-hop packets with rolling sequence deduplication and pushes JSON telemetry via HTTPS PATCH to Firebase Realtime Database. 15-second inactivity watchdog detects network dropouts.
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-tactical-green font-bold uppercase mb-1">3. TACTICAL C2 MISSION CONSOLE</div>
            <div className="text-slate-600 dark:text-slate-400 text-[11px] font-sans">
              Full-screen tactical canvas displays live multi-hop B.A.T.M.A.N. routing, translucent blue circles for active nodes, and pulsing red markers at last-known positions for disconnected nodes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
