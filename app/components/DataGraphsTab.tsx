'use client';

import React, { useState } from 'react';
import { LanguageKey } from '../types/tactical';
import { translations } from '../utils/translations';
import {
  LineChart,
  BarChart3,
  Activity,
  Cpu,
  Zap,
  Target,
  AlertTriangle,
  Info,
  Sparkles,
  TrendingUp,
  Layers,
  Database,
  CheckCircle,
} from 'lucide-react';

interface DataGraphsTabProps {
  language: LanguageKey;
}

// 4-Class Tactical RF Link States for the Fake Gradient Boost Classifier
const CLASSES = [
  { id: 'NOMINAL', label: 'Nominal LoS', color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'JAMMING', label: 'EW Jamming', color: 'text-red-600 dark:text-red-400' },
  { id: 'MULTIPATH', label: 'Multipath Fade', color: 'text-amber-600 dark:text-amber-400' },
  { id: 'SHADOWING', label: 'Wall Shadow', color: 'text-sky-600 dark:text-sky-400' },
];

// 4x4 Fake Confusion Matrix (Actual vs Predicted Counts)
const FAKE_CONFUSION_MATRIX = [
  // Predicted: Nominal, Jamming, Multipath, Shadowing
  [948, 14, 22, 16], // Actual: Nominal (Total = 1000)
  [12, 934, 38, 16], // Actual: Jamming (Total = 1000)
  [18, 26, 918, 38], // Actual: Multipath (Total = 1000)
  [14, 18, 24, 944], // Actual: Shadowing (Total = 1000)
];

const FAKE_FEATURE_IMPORTANCES = [
  { feature: 'SINR_Rolling_Delta_10s', score: 0.342, label: '34.2%' },
  { feature: 'RSSI_Gateway_Attenuation', score: 0.238, label: '23.8%' },
  { feature: 'AS179_Sector_Flap_Count', score: 0.165, label: '16.5%' },
  { feature: 'Packet_Loss_Burst_Rate', score: 0.124, label: '12.4%' },
  { feature: 'MultiHop_Transit_Jitter', score: 0.081, label: '8.1%' },
  { feature: 'Battery_Voltage_Slope', score: 0.050, label: '5.0%' },
];

export const DataGraphsTab: React.FC<DataGraphsTabProps> = ({ language }) => {
  const t = translations[language];
  const [selectedCell, setSelectedCell] = useState<{ actual: number; predicted: number } | null>({
    actual: 1,
    predicted: 1,
  });

  const totalSamples = FAKE_CONFUSION_MATRIX.flat().reduce((a, b) => a + b, 0);
  const totalCorrect = FAKE_CONFUSION_MATRIX.reduce((acc, row, i) => acc + row[i], 0);
  const fakeAccuracy = ((totalCorrect / totalSamples) * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full font-mono select-none pb-12">
      
      {/* Top Header Banner with Explicit FAKE Notice */}
      <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-tactical-cyan" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t.dataGraphsTitle} // ML INFERENCE BENCHMARK
            </h1>
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[10.5px] font-black uppercase tracking-widest">
              ⚠ FAKE / SYNTHETIC MODEL DATA
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-sans mt-1">
            Simulated gradient boosting decision tree classifier (XGBoost / LightGBM) for autonomous RF jamming detection
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs px-3 py-1 font-bold flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-500" /> GRADIENT BOOST V2.4 (FAKE BENCHMARK)
          </span>
        </div>
      </div>

      {/* Model Performance KPI Row (All clearly tagged FAKE) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col justify-between shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">ACCURACY (FAKE)</div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {fakeAccuracy}%
          </div>
          <div className="text-[9px] text-slate-400 font-sans">3,744 / 4,000 Correct</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col justify-between shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">PRECISION (FAKE)</div>
          <div className="text-xl font-extrabold text-sky-600 dark:text-sky-400 font-mono mt-1">
            95.8%
          </div>
          <div className="text-[9px] text-slate-400 font-sans">Macro-averaged</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col justify-between shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">RECALL (FAKE)</div>
          <div className="text-xl font-extrabold text-sky-600 dark:text-sky-400 font-mono mt-1">
            96.1%
          </div>
          <div className="text-[9px] text-slate-400 font-sans">True Positive Rate</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col justify-between shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">F1-SCORE (FAKE)</div>
          <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-1">
            0.959
          </div>
          <div className="text-[9px] text-slate-400 font-sans">Harmonic Mean</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col justify-between shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">ROC-AUC (FAKE)</div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            0.992
          </div>
          <div className="text-[9px] text-slate-400 font-sans">Multi-Class OVO</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-tactical-border p-3.5 flex flex-col justify-between shadow-sm">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">LATENCY (FAKE)</div>
          <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1">
            1.42 ms
          </div>
          <div className="text-[9px] text-slate-400 font-sans">ESP32-S Edge Eval</div>
        </div>
      </div>

      {/* Main Grid: Confusion Matrix & Model Feature Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): FAKE CONFUSION MATRIX */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col gap-4 shadow-sm relative">
          
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-tactical-cyan" />
              <h2 className="text-xs font-bold tracking-wider text-slate-900 dark:text-white uppercase">
                4×4 CONFUSION MATRIX (FAKE GRADIENT BOOST)
              </h2>
            </div>
            <span className="text-[10px] bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 px-2 py-0.5 font-bold border border-red-300 dark:border-red-800">
              SYNTHETIC / FAKE
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              
              {/* Predicted Column Labels */}
              <div className="grid grid-cols-5 text-center text-[10px] font-bold pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="text-slate-400 uppercase">Actual \ Pred</div>
                {CLASSES.map((c) => (
                  <div key={c.id} className={`${c.color} uppercase truncate px-1`}>
                    {c.label}
                  </div>
                ))}
              </div>

              {/* Matrix Rows */}
              {FAKE_CONFUSION_MATRIX.map((row, actIdx) => (
                <div key={actIdx} className="grid grid-cols-5 items-center my-1 text-xs font-mono">
                  {/* Row Label (Actual) */}
                  <div className={`text-[10px] font-bold uppercase truncate pr-2 text-right ${CLASSES[actIdx].color}`}>
                    {CLASSES[actIdx].label}
                  </div>

                  {/* 4 Prediction Cells */}
                  {row.map((val, predIdx) => {
                    const isDiagonal = actIdx === predIdx;
                    const isSelected = selectedCell?.actual === actIdx && selectedCell?.predicted === predIdx;
                    const pct = ((val / 1000) * 100).toFixed(1);

                    return (
                      <div
                        key={predIdx}
                        onClick={() => setSelectedCell({ actual: actIdx, predicted: predIdx })}
                        className={`h-16 m-1 rounded-sm border flex flex-col items-center justify-center cursor-pointer transition-all ${
                          isSelected
                            ? 'ring-2 ring-tactical-cyan scale-105 z-10'
                            : 'hover:scale-[1.02]'
                        } ${
                          isDiagonal
                            ? 'bg-emerald-500/20 dark:bg-emerald-500/25 border-emerald-500/60 text-emerald-800 dark:text-emerald-200'
                            : val > 25
                            ? 'bg-rose-500/20 dark:bg-rose-500/25 border-rose-500/50 text-rose-800 dark:text-rose-200'
                            : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="font-extrabold text-sm">{val}</span>
                        <span className="text-[9px] opacity-75">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Cell Inspection Detail Box */}
          {selectedCell && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-tactical-cyan flex-shrink-0" />
                <div className="text-slate-700 dark:text-slate-300 font-sans text-[11px]">
                  <span className="font-bold text-slate-900 dark:text-white uppercase font-mono">
                    ACTUAL: {CLASSES[selectedCell.actual].label} ➔ PREDICTED: {CLASSES[selectedCell.predicted].label}:
                  </span>{' '}
                  {FAKE_CONFUSION_MATRIX[selectedCell.actual][selectedCell.predicted]} classified instances ({((FAKE_CONFUSION_MATRIX[selectedCell.actual][selectedCell.predicted] / 1000) * 100).toFixed(1)}% of category).
                </div>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-sm border ${
                selectedCell.actual === selectedCell.predicted
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300'
              }`}>
                {selectedCell.actual === selectedCell.predicted ? 'TRUE POSITIVE' : 'CLASSIFICATION ERROR (FAKE)'}
              </span>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Feature Importances & Boosting Convergence */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Feature Importance Card */}
          <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold tracking-wider text-slate-900 dark:text-white uppercase">
                  GRADIENT BOOST FEATURE IMPORTANCES (FAKE)
                </h3>
              </div>
              <span className="text-[9.5px] text-amber-600 dark:text-amber-400 font-bold uppercase">
                XGB-TREES (FAKE)
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {FAKE_FEATURE_IMPORTANCES.map((feat) => (
                <div key={feat.feature} className="space-y-1">
                  <div className="flex justify-between text-[10.5px] font-mono">
                    <span className="text-slate-700 dark:text-slate-300">{feat.feature}</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{feat.label}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div
                      style={{ width: `${feat.score * 100}%` }}
                      className="h-full bg-gradient-to-r from-amber-500 to-tactical-cyan rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loss Convergence Curve (SVG) */}
          <div className="bg-white dark:bg-slate-900 border border-tactical-border p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-tactical-cyan" />
                <h3 className="text-xs font-bold tracking-wider text-slate-900 dark:text-white uppercase">
                  BOOSTING LOSS CONVERGENCE (FAKE)
                </h3>
              </div>
              <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                100 ESTIMATORS (FAKE)
              </span>
            </div>

            <div className="relative w-full bg-slate-50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800">
              <svg viewBox="0 0 320 100" className="w-full h-24">
                {/* Background Gridlines */}
                <line x1="30" y1="20" x2="310" y2="20" stroke="#cbd5e1" strokeDasharray="2 2" strokeWidth="0.5" />
                <line x1="30" y1="50" x2="310" y2="50" stroke="#cbd5e1" strokeDasharray="2 2" strokeWidth="0.5" />
                <line x1="30" y1="80" x2="310" y2="80" stroke="#cbd5e1" strokeDasharray="2 2" strokeWidth="0.5" />

                {/* Training Loss Curve */}
                <path
                  d="M 30 20 Q 60 55, 120 72 T 220 84 T 310 88"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                />
                {/* Validation Loss Curve */}
                <path
                  d="M 30 25 Q 60 60, 120 76 T 220 86 T 310 89"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />

                {/* Legend in SVG */}
                <circle cx="45" cy="12" r="3" fill="#0284c7" />
                <text x="52" y="15" fontSize="7" fill="#64748b">Train Loss (Fake)</text>
                <circle cx="140" cy="12" r="3" fill="#10b981" />
                <text x="147" y="15" fontSize="7" fill="#64748b">Val Loss (Fake)</text>
              </svg>
              <div className="flex justify-between text-[9px] text-slate-400 px-2 pt-1 font-mono">
                <span>Iter 0 (Loss: 1.45)</span>
                <span>Iter 50 (Loss: 0.19)</span>
                <span>Iter 100 (Loss: 0.082)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
