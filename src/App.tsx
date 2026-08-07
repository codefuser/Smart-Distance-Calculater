import { useEffect } from 'react';
import { useGeolocationTracker } from './hooks/useGeolocationTracker';
import { LiveMap } from './components/LiveMap';

export default function App() {
  const {
    currentLocation,
    startLocation,
    path,
    trackingStatus,
    errorMessage,
    startTracking,
  } = useGeolocationTracker();

  // Automatically request GPS position on initial load for map centering
  useEffect(() => {
    startTracking();
  }, [startTracking]);

  return (
    <main className="w-screen h-screen bg-slate-950 p-2 sm:p-4 flex flex-col">
      <div className="w-full h-full flex-1">
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
