'use client';

import React, { useState } from 'react';
import { tacticalBlackbox } from '../utils/offlineDb';
import { Download, Trash2, HardDrive } from 'lucide-react';

interface MissionReplayProps {
  currentPacketCount: number;
  onRefreshCount: () => void;
}

export const MissionReplay: React.FC<MissionReplayProps> = ({
  currentPacketCount,
  onRefreshCount,
}) => {
  const [exporting, setExporting] = useState(false);

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const jsonStr = await tacticalBlackbox.exportLogsAsJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NSG_MANET_BLACKBOX_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleClearBlackbox = async () => {
    if (confirm('CONFIRM PURGE: Clear local IndexedDB mission telemetry blackbox?')) {
      await tacticalBlackbox.clearLogs();
      onRefreshCount();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-tactical-border font-mono text-xs select-none p-2.5 flex items-center justify-between gap-3 shadow-none">
      <div className="flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-tactical-cyan" />
        <div>
          <div className="text-[11px] font-bold text-tactical-textBright">
            MISSION TELEMETRY BLACKBOX (INDEXEDDB)
          </div>
          <div className="text-[9px] text-tactical-textMuted font-medium">
            Zero-latency offline mission logging | {currentPacketCount} telemetry frames stored
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleExportJSON}
          disabled={exporting || currentPacketCount === 0}
          className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center gap-1.5 font-semibold disabled:opacity-40"
        >
          <Download className="w-3 h-3 text-tactical-cyan" />
          EXPORT JSON
        </button>
        <button
          onClick={handleClearBlackbox}
          disabled={currentPacketCount === 0}
          className="px-2 py-1 text-[10px] bg-slate-100 hover:bg-red-50 border border-slate-300 text-slate-600 hover:text-tactical-crimson flex items-center gap-1 font-semibold disabled:opacity-40"
        >
          <Trash2 className="w-3 h-3" />
          PURGE
        </button>
      </div>
    </div>
  );
};
