import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSPoint, TrackingStatus } from '../types';

interface LiveMapProps {
  currentLocation: GPSPoint | null;
  startLocation: GPSPoint | null;
  path: GPSPoint[];
  trackingStatus: TrackingStatus;
  errorMessage: string | null;
}

// Custom DivIcons for crisp dark-mode rendering without asset loading errors
const currentLocationIcon = L.divIcon({
  className: 'custom-live-marker',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
          <span class="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
          <span class="relative inline-flex w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg"></span>
        </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const startMarkerIcon = L.divIcon({
  className: 'custom-start-marker',
  html: `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-lg text-white font-bold text-xs">
          S
        </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const endMarkerIcon = L.divIcon({
  className: 'custom-end-marker',
  html: `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-rose-600 border-2 border-white shadow-lg text-white font-bold text-xs">
          E
        </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Internal helper component to handle map pan/auto-follow
function AutoFollowHandler({
  location,
  isTracking,
}: {
  location: GPSPoint | null;
  isTracking: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (isTracking && location) {
      map.panTo([location.latitude, location.longitude], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [location, isTracking, map]);

  return null;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  currentLocation,
  startLocation,
  path,
  trackingStatus,
  errorMessage,
}) => {
  // Convert path array to leaflet LatLngTuple format
  const polylinePositions: [number, number][] = path.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  // Determine end location (last location in path when tracking is stopped)
  const endLocation =
    trackingStatus === 'stopped' && path.length > 0
      ? path[path.length - 1]
      : null;

  // Fallback initial center (default to college map or 0,0 until GPS acquired)
  const defaultCenter: [number, number] = currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : startLocation
    ? [startLocation.latitude, startLocation.longitude]
    : [13.0827, 80.2707]; // Default Chennai / General coordinate

  if (errorMessage) {
    return (
      <div className="w-full h-full min-h-[300px] bg-slate-900 flex flex-col items-center justify-center p-6 text-center rounded-xl border border-rose-900/50">
        <div className="w-12 h-12 rounded-full bg-rose-950 flex items-center justify-center text-rose-400 mb-3">
          ⚠️
        </div>
        <h3 className="text-slate-200 font-semibold text-base mb-1">GPS Error</h3>
        <p className="text-rose-400 text-xs max-w-xs">{errorMessage}</p>
      </div>
    );
  }

  if (!currentLocation && !startLocation) {
    return (
      <div className="w-full h-full min-h-[300px] bg-slate-900 flex flex-col items-center justify-center p-6 text-center rounded-xl border border-slate-800">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-slate-400 text-sm font-medium">Acquiring GPS Signal...</p>
        <p className="text-slate-500 text-xs mt-1">Please ensure location permissions are granted.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-800 relative">
      <MapContainer
        center={defaultCenter}
        zoom={18}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto follow map view update */}
        <AutoFollowHandler
          location={currentLocation}
          isTracking={trackingStatus === 'tracking'}
        />

        {/* Travel Path Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: '#10b981',
              weight: 5,
              opacity: 0.95,
            }}
          />
        )}

        {/* Start Point Marker */}
        {startLocation && (
          <Marker
            position={[startLocation.latitude, startLocation.longitude]}
            icon={startMarkerIcon}
          />
        )}

        {/* End Point Marker (when tracking stopped) */}
        {endLocation && trackingStatus === 'stopped' && (
          <Marker
            position={[endLocation.latitude, endLocation.longitude]}
            icon={endMarkerIcon}
          />
        )}

        {/* Live Current Location Marker */}
        {currentLocation && (
          <Marker
            position={[currentLocation.latitude, currentLocation.longitude]}
            icon={currentLocationIcon}
          />
        )}
      </MapContainer>
    </div>
  );
};
