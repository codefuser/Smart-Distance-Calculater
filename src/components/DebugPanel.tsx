import React, { useState } from 'react';
import { Terminal, ChevronUp, ChevronDown, CheckCircle2, XCircle, Info } from 'lucide-react';
import { DebugMetrics, GPSPoint } from '../types';

interface DebugPanelProps {
  currentLocation: GPSPoint | null;
  debugMetrics: DebugMetrics;
  totalDistanceMeters: number;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  currentLocation,
  debugMetrics,
  totalDistanceMeters,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const speedKmH =
    currentLocation && currentLocation.speed !== null && currentLocation.speed !== undefined
      ? (currentLocation.speed * 3.6).toFixed(1)
      : '0.0';

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-lg transition-all">
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-850 flex items-center justify-between text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors border-b border-slate-800/50"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-300">Developer Debug Panel</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {debugMetrics.acceptedCount} Accepted / {debugMetrics.rejectedCount} Rejected
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </button>

      {/* Collapsible Panel Content */}
      {isOpen && (
        <div className="p-3 bg-slate-950/80 text-xs font-mono text-slate-300 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Accepted Points */}
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Accepted Points:
              </span>
              <span className="font-bold text-emerald-400">{debugMetrics.acceptedCount}</span>
            </div>

            {/* Rejected Points */}
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <XCircle className="w-3.5 h-3.5 text-rose-400" /> Rejected Points:
              </span>
              <span className="font-bold text-rose-400">{debugMetrics.rejectedCount}</span>
            </div>

            {/* Current Accuracy */}
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Accuracy:</span>
              <span className="font-bold text-indigo-300">
                {currentLocation ? `±${currentLocation.accuracy.toFixed(1)}m` : 'N/A'}
              </span>
            </div>

            {/* Current Speed */}
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Speed:</span>
              <span className="font-bold text-amber-300">{speedKmH} km/h</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Last Movement Delta */}
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Last Movement:</span>
              <span className="font-bold text-cyan-300">
                {debugMetrics.lastMovementDelta.toFixed(2)} m
              </span>
            </div>

            {/* Filtered Distance */}
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Filtered Distance:</span>
              <span className="font-bold text-emerald-300">
                {totalDistanceMeters.toFixed(2)} m
              </span>
            </div>

            {/* Raw Unfiltered Distance */}
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Raw Unfiltered:</span>
              <span className="font-bold text-slate-400">
                {debugMetrics.rawDistanceMeters.toFixed(2)} m
              </span>
            </div>
          </div>

          {/* Last Rejection Reason */}
          {debugMetrics.lastRejectionReason && (
            <div className="p-2 rounded bg-rose-950/40 border border-rose-900/50 flex items-start gap-2 text-rose-300 text-[11px]">
              <Info className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-rose-200">Last Rejected Point Reason: </span>
                {debugMetrics.lastRejectionReason}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
