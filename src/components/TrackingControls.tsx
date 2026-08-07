import React from 'react';
import { Play, Square, RotateCcw, Compass, Activity, Clock, Gauge, Navigation, Signal } from 'lucide-react';
import { GPSPoint, TrackingStatus, AccuracyQuality, GPSSignalStatus } from '../types';

interface TrackingControlsProps {
  currentLocation: GPSPoint | null;
  totalDistanceMeters: number;
  elapsedTime: number;
  rawAccuracy: number | null;
  filteredAccuracy: number | null;
  accuracyQuality: AccuracyQuality;
  gpsSignalStatus: GPSSignalStatus;
  speed: number | null;
  trackingStatus: TrackingStatus;
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

function getStatusBadge(status: TrackingStatus) {
  switch (status) {
    case 'tracking':
      return {
        label: 'Tracking',
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-500 animate-pulse',
      };
    case 'stopped':
      return {
        label: 'Stopped',
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        dot: 'bg-rose-500',
      };
    case 'error':
      return {
        label: 'Error',
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-500',
      };
    case 'idle':
    default:
      return {
        label: 'Idle',
        bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        dot: 'bg-slate-500',
      };
  }
}

function getSignalBadge(status: GPSSignalStatus) {
  switch (status) {
    case 'Excellent Signal':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Good Signal':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'Weak Signal':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Searching':
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30 animate-pulse';
  }
}

export const TrackingControls: React.FC<TrackingControlsProps> = ({
  currentLocation,
  totalDistanceMeters,
  elapsedTime,
  rawAccuracy,
  filteredAccuracy,
  gpsSignalStatus,
  speed,
  trackingStatus,
  startTracking,
  stopTracking,
  resetTracking,
}) => {
  const isTracking = trackingStatus === 'tracking';
  const statusBadge = getStatusBadge(trackingStatus);
  const signalBadgeClass = getSignalBadge(gpsSignalStatus);

  const speedKmH = speed !== null && speed >= 0 ? (speed * 3.6).toFixed(1) : '0.0';

  return (
    <div className="w-full space-y-3">
      {/* Control Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={startTracking}
          disabled={isTracking}
          className={`flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-md ${
            isTracking
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 active:scale-[0.98]'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          Start Tracking
        </button>

        <button
          onClick={stopTracking}
          disabled={!isTracking}
          className={`flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-md ${
            !isTracking
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 active:scale-[0.98]'
          }`}
        >
          <Square className="w-4 h-4 fill-current" />
          Stop Tracking
        </button>

        <button
          onClick={resetTracking}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Live Information Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Total Distance */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Total Distance
          </div>
          <div className="text-base font-bold text-slate-100 truncate">
            {totalDistanceMeters.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">m</span>
          </div>
          <div className="text-xs text-slate-400 truncate">
            {(totalDistanceMeters / 1000).toFixed(3)} km
          </div>
        </div>

        {/* Position */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            Position (Lat / Lng)
          </div>
          <div className="text-xs font-mono font-semibold text-slate-200 truncate">
            {currentLocation ? currentLocation.latitude.toFixed(6) : '---'}
          </div>
          <div className="text-xs font-mono text-slate-400 truncate">
            {currentLocation ? currentLocation.longitude.toFixed(6) : '---'}
          </div>
        </div>

        {/* Raw & Filtered GPS Accuracy */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-indigo-400" /> GPS Accuracy
            </span>
          </div>
          <div className="text-xs space-y-0.5 font-mono">
            <div className="text-slate-200 font-semibold">
              Raw: {rawAccuracy !== null ? `±${rawAccuracy.toFixed(1)}m` : '---'}
            </div>
            <div className="text-emerald-400">
              Filtered: {filteredAccuracy !== null ? `±${filteredAccuracy.toFixed(1)}m` : '---'}
            </div>
          </div>
        </div>

        {/* Current Speed */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            Current Speed
          </div>
          <div className="text-base font-bold text-slate-100 truncate">
            {speedKmH}{' '}
            <span className="text-xs font-normal text-slate-400">km/h</span>
          </div>
          <div className="text-xs text-slate-400">
            {speed !== null ? `${speed.toFixed(1)} m/s` : '0.0 m/s'}
          </div>
        </div>

        {/* Elapsed Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            Elapsed Time
          </div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            {formatTime(elapsedTime)}
          </div>
          <div className="text-xs text-slate-400">Timer</div>
        </div>

        {/* GPS Signal Status & Tracking Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Signal:</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${signalBadgeClass}`}
            >
              <Signal className="w-3 h-3" />
              {gpsSignalStatus}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-xs font-medium text-slate-400">Status:</span>
            <div
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.bg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
              {statusBadge.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
