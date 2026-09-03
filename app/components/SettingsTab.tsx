'use client';

import React from 'react';
import { LanguageKey, ThemeMode } from '../types/tactical';
import { translations } from '../utils/translations';
import {
  Settings,
  Moon,
  Sun,
  Globe,
  Radio,
  Sliders,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from 'lucide-react';

interface SettingsTabProps {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: LanguageKey;
  setLanguage: (lang: LanguageKey) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  theme,
  setTheme,
  language,
  setLanguage,
}) => {
  const t = translations[language];

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full font-mono select-none pb-12">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-tactical-cyan" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t.settingsTitle}
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-sans mt-1">
            {t.settingsSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>SYSTEM INTEGRITY: 100% OK</span>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* 1. Theme Configuration */}
        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Sun className="w-4 h-4 text-tactical-amber" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t.themePreference}
            </h2>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 font-sans">
            Choose between Tactical C2 high-contrast daylight theme and tactical C2 low-light night operations theme.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => setTheme('light')}
              className={`p-3 border flex flex-col items-center justify-center gap-2 text-xs font-bold transition-all ${
                theme === 'light'
                  ? 'border-tactical-cyan bg-sky-50 dark:bg-sky-950/60 text-tactical-cyan shadow-sm ring-1 ring-tactical-cyan'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
              }`}
            >
              <Sun className="w-5 h-5 text-amber-500" />
              <span>{t.lightMode}</span>
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={`p-3 border flex flex-col items-center justify-center gap-2 text-xs font-bold transition-all ${
                theme === 'dark'
                  ? 'border-tactical-cyan bg-sky-950 text-tactical-cyan shadow-sm ring-1 ring-tactical-cyan'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
              }`}
            >
              <Moon className="w-5 h-5 text-tactical-cyan" />
              <span>{t.darkMode}</span>
            </button>
          </div>
        </div>

        {/* 2. Language Selection */}
        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Globe className="w-4 h-4 text-tactical-cyan" />
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t.languageSelect}
            </h2>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 font-sans">
            Select the active language for C2 mission telemetry, warning alerts, and helmet tactical feedback.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {[
              { key: 'en' as LanguageKey, label: 'English (US/UK)' },
              { key: 'hi' as LanguageKey, label: 'हिन्दी (Hindi)' },
              { key: 'es' as LanguageKey, label: 'Español (Spanish)' },
              { key: 'fr' as LanguageKey, label: 'Français (French)' },
              { key: 'de' as LanguageKey, label: 'Deutsch (German)' },
            ].map((lang) => (
              <button
                key={lang.key}
                onClick={() => setLanguage(lang.key)}
                className={`px-3 py-2 border text-xs font-bold text-left flex items-center justify-between transition-colors ${
                  language === lang.key
                    ? 'border-tactical-cyan bg-sky-50 dark:bg-sky-950/60 text-tactical-cyan'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                <span>{lang.label}</span>
                {language === lang.key && <span className="text-[10px] bg-tactical-cyan text-white px-1.5 py-0.2">ACTIVE</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 3. RF Frequency & Transmission Parameters */}
        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-tactical-cyan" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t.radioFreqConfig}
              </h2>
            </div>
            <span className="text-[10px] bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold px-2 py-0.5 border border-sky-300 dark:border-sky-800">
              XIAO ESP32-C6 + AS179
            </span>
          </div>

          <div className="flex flex-col gap-2.5 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Carrier & Channel:</span>
              <span className="font-bold text-slate-900 dark:text-white">2.4 GHz ISM (2412 MHz • Ch 1)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Channel Bandwidth (HT20):</span>
              <span className="font-bold text-slate-900 dark:text-white">20.0 MHz (72.2 Mbps PHY / 802.11b/g/n)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Tx Power Output:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">+20.0 dBm (100 mW EIRP, 0.25dB step)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Rx Sensitivity (ESP-NOW):</span>
              <span className="font-bold text-slate-900 dark:text-white">-99 dBm (1Mbps) / -108 dBm (LR Mode)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Internal RF Switch (Seeed):</span>
              <span className="font-bold text-tactical-cyan">GPIO 3 (EN=LOW) ➔ GPIO 14 (u.FL=HIGH)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">External SPDT (AS179-92LF):</span>
              <span className="font-bold text-slate-900 dark:text-white">D4 (GPIO 22 = V1) & D5 (GPIO 23 = V2)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Antenna Truth Table:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Ant1 (V1=1, V2=0) | Ant2 (V1=0, V2=1)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Switch Settle & Hysteresis:</span>
              <span className="font-bold text-slate-900 dark:text-white">5ms Settle • 4dB Margin Hysteresis</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Packet Struct & Framing:</span>
              <span className="font-bold text-slate-900 dark:text-white">32B MeshPacket (magic=0x5348, TTL=3)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Metamaterial SAR Shield:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">0.076 W/kg (PASS &lt; 1.6 W/kg)</span>
            </div>
          </div>
        </div>

        {/* 4. Diagnostics & System Health */}
        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-tactical-cyan" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t.systemHealth}
              </h2>
            </div>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 border border-emerald-300 dark:border-emerald-800">
              ESP-NOW SINK MESH
            </span>
          </div>

          <div className="flex flex-col gap-2.5 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">TOC Gateway AP_STA Sink:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">SSID: "MESH-GW" Beacon + STA Uplink</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Rx Ingress Ringbuffer:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">RxQueue[24] portMUX_TYPE (0 Dropped)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Deduplication Cache:</span>
              <span className="font-bold text-slate-900 dark:text-white">Seen[32] Rolling Sequence FIFO</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Relay Queue & Anti-Collision:</span>
              <span className="font-bold text-slate-900 dark:text-white">RelayQueue[12] • Jitter &le; 40ms</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Heartbeat Watchdog:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">15.0s Timeout (Stale ➔ Offline Red)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Firebase RTDB Ingress:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">HTTPS PATCH /nodes.json (5000ms)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 font-sans">Edge Mesh Solver & Healing:</span>
              <span className="font-bold text-tactical-cyan">B.A.T.M.A.N. + Ghost Healer (60 FPS)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
