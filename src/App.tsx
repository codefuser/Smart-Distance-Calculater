import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeolocationTracker } from './hooks/useGeolocationTracker';
import { LiveMap } from './components/LiveMap';
import { TrackingControls } from './components/TrackingControls';
import { SessionHistory } from './components/SessionHistory';
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

  const {
    currentLocation,
    startLocation,
    path,
    totalDistanceMeters,
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
  } = useGeolocationTracker();

  const prevStatusRef = useRef(trackingStatus);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    setSessions(getSavedSessions());
  }, []);

  useEffect(() => {
    if (trackingStatus === 'tracking' && prevStatusRef.current !== 'tracking') {
      startTimeRef.current = Date.now();
    }

    if (
      prevStatusRef.current === 'tracking' &&
      trackingStatus === 'stopped' &&
      path.length > 0 &&
      totalDistanceMeters > 0
    ) {
      const newSession = buildMeasurementSession(
        path,
        totalDistanceMeters,
        elapsedTime,
        startTimeRef.current
      );
      saveSession(newSession);
      setSessions(getSavedSessions());
    }

    prevStatusRef.current = trackingStatus;
  }, [trackingStatus, path, totalDistanceMeters, elapsedTime]);

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
            elapsedTime={elapsedTime}
            gpsAccuracy={gpsAccuracy}
            accuracyQuality={accuracyQuality}
            gpsSignalStatus={gpsSignalStatus}
            speed={speed}
            trackingStatus={trackingStatus}
            startTracking={startTracking}
            stopTracking={handleStopTracking}
            resetTracking={resetTracking}
          />

          {/* Live Map */}
          <div className="flex-1 w-full min-h-0 relative">
            <LiveMap
              currentLocation={currentLocation}
              startLocation={startLocation}
              path={path}
              totalDistanceMeters={totalDistanceMeters}
              gpsAccuracy={gpsAccuracy}
              speed={speed}
              gpsSignalStatus={gpsSignalStatus}
              trackingStatus={trackingStatus}
              errorMessage={errorMessage}
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
    </main>
  );
}
