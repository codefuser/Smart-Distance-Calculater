import React, { useState } from 'react';
import { Play, Square, RotateCcw, Compass, Activity, Clock, Gauge, Signal, BookmarkPlus, Maximize2, Minimize2, Tag, Edit2, Check, ArrowUpRight } from 'lucide-react';
import { GPSPoint, TrackingStatus, AccuracyQuality, GPSSignalStatus, RouteMark, DirectionalDistances } from '../types';

interface TrackingControlsProps {
  currentLocation: GPSPoint | null;
  totalDistanceMeters: number;
  straightLineDistanceMeters?: number;
  directionalDistances?: DirectionalDistances;
  elapsedTime: number;
  gpsAccuracy: number | null;
  accuracyQuality: AccuracyQuality;
  gpsSignalStatus: GPSSignalStatus;
  speed: number | null;
  headingAngle?: number | null;
  cardinalDirection?: string;
  trackingStatus: TrackingStatus;
  marks?: RouteMark[];
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
  onAddMark?: () => void;
  onUpdateMarkNote?: (id: string, note: string) => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
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
    case 'initializing':
      return {
        label: 'Initializing',
        bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        dot: 'bg-cyan-400 animate-ping',
      };
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
  currentLocation: _currentLocation,
  totalDistanceMeters,
  straightLineDistanceMeters = 0,
  directionalDistances = { north: 0, east: 0, south: 0, west: 0 },
  elapsedTime,
  gpsAccuracy,
  accuracyQuality: _accuracyQuality,
  gpsSignalStatus,
  speed,
  headingAngle = null,
  cardinalDirection = 'N',
  trackingStatus,
  marks = [],
  startTracking,
  stopTracking,
  resetTracking,
  onAddMark,
  onUpdateMarkNote,
  onToggleFullscreen,
  isFullscreen = false,
}) => {
  const isTracking = trackingStatus === 'tracking' || trackingStatus === 'initializing';
  const statusBadge = getStatusBadge(trackingStatus);
  const signalBadgeClass = getSignalBadge(gpsSignalStatus);
  const speedKmH = speed !== null && speed >= 0 ? (speed * 3.6).toFixed(1) : '0.0';

  const [editingMarkId, setEditingMarkId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');

  const handleStartEditNote = (mark: RouteMark) => {
    setEditingMarkId(mark.id);
    setEditingNoteText(mark.note || '');
  };

  const handleSaveNote = (id: string) => {
    if (onUpdateMarkNote) {
      onUpdateMarkNote(id, editingNoteText);
    }
    setEditingMarkId(null);
  };

  return (
    <div className="w-full space-y-3">
      {/* Control Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={startTracking}
          disabled={isTracking}
          className={`flex-1 min-w-[110px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all shadow-md ${
            isTracking
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 active:scale-[0.98]'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          {trackingStatus === 'initializing' ? 'Initializing GPS...' : 'Start Tracking'}
        </button>

        {onAddMark && (
          <button
            onClick={onAddMark}
            disabled={trackingStatus !== 'tracking'}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all shadow-md ${
              trackingStatus !== 'tracking'
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 active:scale-[0.98]'
            }`}
            title="Snapshot turning point / milestone without stopping tracking"
          >
            <BookmarkPlus className="w-4 h-4 fill-current" />
            MARK {marks.length > 0 ? `(${marks.length})` : ''}
          </button>
        )}

        <button
          onClick={stopTracking}
          disabled={!isTracking}
          className={`flex-1 min-w-[110px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all shadow-md ${
            !isTracking
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 active:scale-[0.98]'
          }`}
        >
          <Square className="w-4 h-4 fill-current" />
          Stop Tracking
        </button>

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 active:scale-[0.98]"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map Mode'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden xs:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        )}

        <button
          onClick={resetTracking}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Live Information Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Total Travel Distance */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Total Distance
          </div>
          <div className="text-base font-bold text-slate-100 truncate">
            {totalDistanceMeters.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">m</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            Straight-line: {straightLineDistanceMeters.toFixed(1)}m
          </div>
        </div>

        {/* Directional Distances (N/E/S/W) */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
            Vectors (N/E/S/W)
          </div>
          <div className="text-xs font-mono font-semibold text-slate-200 grid grid-cols-2 gap-x-1 truncate">
            <span>N: {directionalDistances.north.toFixed(1)}m</span>
            <span>E: {directionalDistances.east.toFixed(1)}m</span>
            <span>S: {directionalDistances.south.toFixed(1)}m</span>
            <span>W: {directionalDistances.west.toFixed(1)}m</span>
          </div>
        </div>

        {/* GPS Accuracy */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            Compass / Heading
          </div>
          <div className="text-base font-bold text-slate-100 truncate font-mono">
            {cardinalDirection}{' '}
            <span className="text-xs font-normal text-slate-400">
              {headingAngle !== null ? `(${headingAngle}°)` : '---'}
            </span>
          </div>
          <div className="text-xs text-slate-400">Accuracy: ±{gpsAccuracy?.toFixed(1) ?? '--'}m</div>
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

        {/* GPS Signal & Tracking Status */}
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

      {/* Route Marks Section */}
      {marks.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Tag className="w-4 h-4" />
              Route Marks ({marks.length})
            </div>
            <span className="text-[10px] text-slate-400">Primary: Distance from Start</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
            {marks.map((m) => (
              <div
                key={m.id}
                className="bg-slate-950 border border-slate-800 rounded-md p-2 flex flex-col justify-between space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 bg-amber-950/80 border border-amber-800/50 px-2 py-0.5 rounded">
                    MARK {m.number}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{m.timeFormatted}</span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div className="text-xs font-bold text-slate-100">
                    {m.distanceFromStartMeters.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">m from start</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Segment: <span className="font-semibold text-slate-300">{m.segmentDistanceMeters.toFixed(1)} m</span>
                  </div>
                </div>

                {/* Optional Note */}
                <div className="pt-1 border-t border-slate-900 flex items-center justify-between text-[11px]">
                  {editingMarkId === m.id ? (
                    <div className="flex items-center gap-1 w-full">
                      <input
                        type="text"
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        placeholder="e.g. IC Classroom..."
                        className="flex-1 bg-slate-900 border border-amber-500/50 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveNote(m.id);
                        }}
                      />
                      <button
                        onClick={() => handleSaveNote(m.id)}
                        className="bg-amber-500 text-slate-950 font-bold p-1 rounded hover:bg-amber-400"
                        title="Save Note"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-slate-400 italic truncate max-w-[180px]">
                        {m.note ? `"${m.note}"` : <span className="text-slate-600 font-normal">No note</span>}
                      </span>
                      {onUpdateMarkNote && (
                        <button
                          onClick={() => handleStartEditNote(m)}
                          className="text-slate-500 hover:text-amber-400 p-0.5"
                          title="Add / Edit Note"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

