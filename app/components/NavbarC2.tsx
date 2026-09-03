'use client';

import React from 'react';
import {
  TabKey,
  OperationalMode,
  LanguageKey,
  ThemeMode,
} from '../types/tactical';
import { translations } from '../utils/translations';
import {
  Home,
  LayoutDashboard,
  PlaySquare,
  Server,
  Bell,
  LineChart,
  Settings,
  Radio,
  Activity,
  ShieldAlert,
  Wifi,
} from 'lucide-react';

interface NavbarC2Props {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  language: LanguageKey;
  wsConnected: boolean;
  jammerActive: boolean;
  systemSinrAvg: number;
  livePacketsCount: number;
  activeNodesCount: number;
  alertsCount?: number;
}

export const NavbarC2: React.FC<NavbarC2Props> = ({
  activeTab,
  setActiveTab,
  language,
  wsConnected,
  jammerActive,
  systemSinrAvg,
  livePacketsCount,
  activeNodesCount,
  alertsCount = 0,
}) => {
  const t = translations[language];

  const navItems: { key: TabKey; label: string; icon: React.ReactNode; badge?: string | number; badgeColor?: string }[] = [
    { key: 'home', label: t.navHome, icon: <Home className="w-3.5 h-3.5" /> },
    { key: 'dashboard', label: t.navDashboard, icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { key: 'simulate', label: t.navSimulate, icon: <PlaySquare className="w-3.5 h-3.5" /> },
    {
      key: 'nodes',
      label: t.navNodes,
      icon: <Server className="w-3.5 h-3.5" />,
      badge: activeNodesCount,
    },
    {
      key: 'alerts',
      label: t.navAlerts,
      icon: <Bell className={`w-3.5 h-3.5 ${alertsCount > 0 ? 'text-red-500 animate-bounce' : ''}`} />,
      badge: alertsCount > 0 ? alertsCount : undefined,
      badgeColor: 'bg-red-500 text-white animate-pulse',
    },
    { key: 'data-graphs', label: t.navDataGraphs, icon: <LineChart className="w-3.5 h-3.5" /> },
    { key: 'settings', label: t.navSettings, icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-tactical-border dark:border-slate-800 bg-white dark:bg-slate-950 font-mono select-none shadow-sm transition-colors">
      <div className="max-w-[1920px] mx-auto px-3 flex flex-wrap items-center justify-between gap-2 min-h-[50px] py-1">
        
        {/* Left: Branding */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 border border-tactical-border dark:border-slate-800 px-2.5 py-1 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
          >
            <Radio className="w-4 h-4 text-tactical-cyan animate-pulse" />
            <span className="text-xs font-bold tracking-wider text-slate-900 dark:text-white">
              {t.c2Title}
            </span>
            <span className="text-[9px] bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 px-1 py-0.2 font-semibold">
              PS 26185
            </span>
          </div>

          {/* Quick Status Pill */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            {activeTab === 'dashboard' ? (
              <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE HW ({livePacketsCount} PKTS)</span>
              </div>
            ) : jammerActive ? (
              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 px-2 py-0.5 text-tactical-crimson text-[10px] font-bold animate-pulse">
                <ShieldAlert className="w-3 h-3" />
                <span>JAMMER ON</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Center: Main Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-0.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors border ${
                  isActive
                    ? 'bg-tactical-cyan text-white border-tactical-cyan shadow-sm font-bold'
                    : 'bg-transparent text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 text-[9.5px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-white text-tactical-cyan'
                        : item.badgeColor ||
                          'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Status Capsule */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-tactical-border dark:border-slate-800 text-xs">
            <Wifi className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span className="text-[10.5px] text-slate-600 dark:text-slate-400 font-semibold">
              {wsConnected ? 'WS LIVE' : 'WS READY'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

