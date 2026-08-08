import React, { useEffect, useState } from 'react';
import { X, Download, Activity, Clock, Navigation, Tag, Image as ImageIcon } from 'lucide-react';
import { MeasurementSession } from '../types';
import { generateRouteCanvasImage, downloadRouteImage } from '../utils/routeImageGenerator';

interface RouteSummaryModalProps {
  session: MeasurementSession;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export const RouteSummaryModal: React.FC<RouteSummaryModalProps> = ({ session, onClose }) => {
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    generateRouteCanvasImage(session)
      .then((url) => {
        if (isMounted) {
          setImagePreviewUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate route image', err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  const handleDownloadImage = () => {
    if (imagePreviewUrl) {
      const safeName = session.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      downloadRouteImage(imagePreviewUrl, `${safeName}_route_map.png`);
    }
  };

  const d = session.directionalDistances || { north: 0, east: 0, south: 0, west: 0 };
  const marks = session.marks || [];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/50 px-2 py-0.5 rounded">
              Route Completed & Summarized
            </span>
            <h2 className="text-lg font-bold text-slate-100 mt-1">{session.name}</h2>
          </div>

          <div className="flex items-center gap-2">
            {imagePreviewUrl && (
              <button
                onClick={handleDownloadImage}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Save Route Image</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Key Metrics Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Traveled Distance */}
            <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-3.5 shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Activity className="w-4 h-4" /> Total Travel Distance
                </span>
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">
                {session.totalDistanceMeters.toFixed(2)} <span className="text-xs text-slate-400">m</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Cumulative path distance</div>
            </div>

            {/* Straight-line Distance */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <Navigation className="w-4 h-4" /> Straight-Line Distance
                </span>
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">
                {session.straightLineDistanceMeters !== undefined
                  ? session.straightLineDistanceMeters.toFixed(2)
                  : '---'}{' '}
                <span className="text-xs text-slate-400">m</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Start-to-End direct vector</div>
            </div>

            {/* Duration */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 text-purple-400">
                  <Clock className="w-4 h-4" /> Total Duration
                </span>
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono">
                {formatDuration(session.durationSeconds)}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Max: {session.maxSpeedKmH.toFixed(1)} km/h</div>
            </div>

            {/* Directional Vectors */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-md">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Tag className="w-4 h-4" /> Directional Distances
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs font-mono font-bold text-slate-200">
                <span>N: {d.north.toFixed(1)}m</span>
                <span>E: {d.east.toFixed(1)}m</span>
                <span>S: {d.south.toFixed(1)}m</span>
                <span>W: {d.west.toFixed(1)}m</span>
              </div>
            </div>
          </div>

          {/* Generated Canvas Route Image Preview */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <ImageIcon className="w-4 h-4" />
                Generated Route Image Summary
              </div>
              {imagePreviewUrl && (
                <button
                  onClick={handleDownloadImage}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline"
                >
                  Download PNG
                </button>
              )}
            </div>

            <div className="w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center min-h-[220px]">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400 text-xs">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  Rendering route Canvas image...
                </div>
              ) : imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Recorded Route Map Summary"
                  className="w-full h-auto max-h-[380px] object-contain rounded-lg"
                />
              ) : (
                <div className="text-slate-500 text-xs p-6 text-center">
                  Could not generate route image preview.
                </div>
              )}
            </div>
          </div>

          {/* Route Marks Snapshot Breakdown */}
          {marks.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Tag className="w-4 h-4" /> Route Marks ({marks.length})
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {marks.map((m) => (
                  <div
                    key={m.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800/50">
                        MARK {m.number}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{m.timeFormatted}</span>
                    </div>

                    <div className="text-slate-100 font-bold">
                      {m.distanceFromStartMeters.toFixed(1)} m <span className="text-[10px] text-slate-400 font-normal">from start</span>
                    </div>

                    <div className="text-slate-400 text-[11px] flex items-center justify-between">
                      <span>Segment: {m.segmentDistanceMeters.toFixed(1)} m</span>
                      {m.cardinalDirection && (
                        <span className="font-bold text-cyan-400">Dir: {m.cardinalDirection}</span>
                      )}
                    </div>

                    {m.note && (
                      <div className="text-amber-200 italic bg-amber-950/40 p-1.5 rounded border border-amber-900/40 mt-1">
                        "{m.note}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
