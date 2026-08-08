import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeolocationTracker } from './hooks/useGeolocationTracker';
import { useCompassHeading } from './hooks/useCompassHeading';
import { LiveMap } from './components/LiveMap';
import { TrackingControls } from './components/TrackingControls';
import { SessionHistory } from './components/SessionHistory';
import { RouteSummaryModal } from './components/RouteSummaryModal';
import { MeasurementSession } from './types';
import {
  getSavedSessions,
  saveSession,
  deleteSession as deleteSessionStorage,
  clearAllSessions as clearAllStorage,
  buildMeasurementSession,
} from './utils/storage';
import { Radio, History } from 'lucide-react';

type ActiveTab = 'tracker' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tracker');
  const [sessions, setSessions] = useState<MeasurementSession[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [summarySession, setSummarySession] = useState<MeasurementSession | null>(null);

  const {
    headingAngle,
    cardinalDirection,
    needsPermission: compassNeedsPermission,
    requestCompassPermission: onRequestCompassPermission,
  } = useCompassHeading();

  const {
    currentLocation,
    startLocation,
    path,
    marks,
    totalDistanceMeters,
    straightLineDistanceMeters,
    directionalDistances,
    elapsedTime,
    gpsAccuracy,
    accuracyQuality,
    gpsSignalStatus,
    speed,
    trackingStatus,
    errorMessage,
    startTracking,
    stopTracking,
    resetTracking,
    addMark,
    updateMarkNote,
  } = useGeolocationTracker();

  const prevStatusRef = useRef(trackingStatus);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    setSessions(getSavedSessions());
  }, []);

  useEffect(() => {
    if (
      (trackingStatus === 'initializing' || trackingStatus === 'tracking') &&
      prevStatusRef.current !== 'initializing' &&
      prevStatusRef.current !== 'tracking'
    ) {
      startTimeRef.current = Date.now();
    }

    if (
      (prevStatusRef.current === 'tracking' || prevStatusRef.current === 'initializing') &&
      trackingStatus === 'stopped' &&
      path.length > 0
    ) {
      const newSession = buildMeasurementSession(
        path,
        totalDistanceMeters,
        elapsedTime,
        startTimeRef.current,
        marks
      );
      newSession.straightLineDistanceMeters = straightLineDistanceMeters;
      newSession.directionalDistances = directionalDistances;

      saveSession(newSession);
      setSessions(getSavedSessions());
      setSummarySession(newSession);
    }

    prevStatusRef.current = trackingStatus;
  }, [trackingStatus, path, totalDistanceMeters, straightLineDistanceMeters, directionalDistances, elapsedTime, marks]);

  const handleStopTracking = useCallback(() => {
    stopTracking();
  }, [stopTracking]);

  const handleDeleteSession = useCallback((id: string) => {
    const updated = deleteSessionStorage(id);
    setSessions(updated);
  }, []);

  const handleClearAllSessions = useCallback(() => {
    clearAllStorage();
    setSessions([]);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleAddMark = useCallback(() => {
    addMark(undefined, headingAngle ?? undefined, cardinalDirection);
  }, [addMark, headingAngle, cardinalDirection]);

  return (
    <main className="w-screen h-screen bg-slate-950 p-2 sm:p-4 flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-1">
        <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          Distance Meter
        </h1>

        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'tracker'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Live Tracker
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History ({sessions.length})
          </button>
        </div>
      </header>

      {/* Main Content */}
      {activeTab === 'tracker' ? (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Top Controls & Metrics */}
          <TrackingControls
            currentLocation={currentLocation}
            totalDistanceMeters={totalDistanceMeters}
            straightLineDistanceMeters={straightLineDistanceMeters}
            directionalDistances={directionalDistances}
            elapsedTime={elapsedTime}
            gpsAccuracy={gpsAccuracy}
            accuracyQuality={accuracyQuality}
            gpsSignalStatus={gpsSignalStatus}
            speed={speed}
            headingAngle={headingAngle}
            cardinalDirection={cardinalDirection}
            trackingStatus={trackingStatus}
            marks={marks}
            startTracking={startTracking}
            stopTracking={handleStopTracking}
            resetTracking={resetTracking}
            onAddMark={handleAddMark}
            onUpdateMarkNote={updateMarkNote}
            onToggleFullscreen={handleToggleFullscreen}
            isFullscreen={isFullscreen}
          />

          {/* Live Map */}
          <div className="flex-1 w-full min-h-0 relative">
            <LiveMap
              currentLocation={currentLocation}
              startLocation={startLocation}
              path={path}
              marks={marks}
              totalDistanceMeters={totalDistanceMeters}
              gpsAccuracy={gpsAccuracy}
              speed={speed}
              headingAngle={headingAngle}
              cardinalDirection={cardinalDirection}
              gpsSignalStatus={gpsSignalStatus}
              trackingStatus={trackingStatus}
              errorMessage={errorMessage}
              onAddMark={handleAddMark}
              isFullscreen={isFullscreen}
              onToggleFullscreen={handleToggleFullscreen}
              compassNeedsPermission={compassNeedsPermission}
              onRequestCompassPermission={onRequestCompassPermission}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1">
          <SessionHistory
            sessions={sessions}
            onDeleteSession={handleDeleteSession}
            onClearAllSessions={handleClearAllSessions}
          />
        </div>
      )}

      {/* Post-Session Route Summary Modal */}
      {summarySession && (
        <RouteSummaryModal
          session={summarySession}
          onClose={() => setSummarySession(null)}
        />
      )}
    </main>
  );
}
