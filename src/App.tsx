import { useGeolocationTracker } from './hooks/useGeolocationTracker';
import { LiveMap } from './components/LiveMap';
import { TrackingControls } from './components/TrackingControls';

export default function App() {
  const {
    currentLocation,
    startLocation,
    path,
    totalDistanceMeters,
    elapsedTime,
    gpsAccuracy,
    speed,
    trackingStatus,
    errorMessage,
    startTracking,
    stopTracking,
    resetTracking,
  } = useGeolocationTracker();

  return (
    <main className="w-screen h-screen bg-slate-950 p-2 sm:p-4 flex flex-col gap-3 overflow-hidden">
      {/* Header Title */}
      <header className="flex items-center justify-between px-1">
        <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          Distance Meter
        </h1>
        <span className="text-xs text-slate-500 font-mono">Live Measurement Tool</span>
      </header>

      {/* Top Controls & Live Information Cards */}
      <TrackingControls
        currentLocation={currentLocation}
        totalDistanceMeters={totalDistanceMeters}
        elapsedTime={elapsedTime}
        gpsAccuracy={gpsAccuracy}
        speed={speed}
        trackingStatus={trackingStatus}
        startTracking={startTracking}
        stopTracking={stopTracking}
        resetTracking={resetTracking}
      />

      {/* Below: Live Map Container */}
      <div className="flex-1 w-full min-h-0 relative">
        <LiveMap
          currentLocation={currentLocation}
          startLocation={startLocation}
          path={path}
          trackingStatus={trackingStatus}
          errorMessage={errorMessage}
        />
      </div>
    </main>
  );
}
