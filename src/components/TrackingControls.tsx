import React from 'react';
import { Play, Square, RotateCcw, Compass, Activity, Clock, Gauge, Navigation } from 'lucide-react';
import { GPSPoint, TrackingStatus } from '../types';

interface TrackingControlsProps {
  currentLocation: GPSPoint | null;
  totalDistanceMeters: number;
  elapsedTime: number;
  gpsAccuracy: number | null;
  speed: number | null;
  trackingStatus: TrackingStatus;
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
}

// Helper to format elapsed time in HH:MM:SS or MM:SS
function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

// Status color helper badge
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

export const TrackingControls: React.FC<TrackingControlsProps> = ({
  currentLocation,
  totalDistanceMeters,
  elapsedTime,
  gpsAccuracy,
  speed,
  trackingStatus,
  startTracking,
  stopTracking,
  resetTracking,
}) => {
  const isTracking = trackingStatus === 'tracking';
  const statusBadge = getStatusBadge(trackingStatus);

  // Speed in km/h (speed from geolocation API is in m/s)
  const speedKmH = speed !== null && speed >= 0 ? (speed * 3.6).toFixed(1) : '0.0';

  return (
    <div className="w-full space-y-3">
      {/* 1. Control Buttons */}
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

      {/* 2. Live Information Cards */}
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

        {/* Current Coordinates */}
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

        {/* GPS Accuracy */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            GPS Accuracy
          </div>
          <div className="text-base font-bold text-slate-100 truncate">
            {gpsAccuracy !== null ? `±${gpsAccuracy.toFixed(1)}` : '---'}{' '}
            <span className="text-xs font-normal text-slate-400">m</span>
          </div>
          <div className="text-xs text-slate-400">
            {gpsAccuracy !== null && gpsAccuracy <= 20 ? 'Good Signal' : 'Acquiring'}
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

        {/* Tracking Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="text-xs font-medium text-slate-400 mb-1.5">Status</div>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge.bg}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
            {statusBadge.label}
          </div>
        </div>
      </div>
    </div>
  );
};
