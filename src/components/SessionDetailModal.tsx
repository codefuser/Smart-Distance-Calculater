import React from 'react';
import { X, Download, Calendar, Clock, Activity, Compass, Gauge, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { MeasurementSession } from '../types';
import { exportSessionJSON } from '../utils/storage';

interface SessionDetailModalProps {
  session: MeasurementSession;
  onClose: () => void;
}

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

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({ session, onClose }) => {
  const polylinePositions: [number, number][] = session.path.map((p) => [p.latitude, p.longitude]);

  const mapCenter: [number, number] = session.startLocation
    ? [session.startLocation.latitude, session.startLocation.longitude]
    : [13.0827, 80.2707];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100">{session.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{session.date}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSessionJSON(session)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Map Preview */}
          <div className="w-full h-64 sm:h-80 rounded-lg overflow-hidden border border-slate-800 relative">
            {polylinePositions.length > 0 ? (
              <MapContainer center={mapCenter} zoom={16} className="w-full h-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Polyline
                  positions={polylinePositions}
                  pathOptions={{ color: '#10b981', weight: 5, opacity: 0.95 }}
                />

                {session.startLocation && (
                  <Marker
                    position={[session.startLocation.latitude, session.startLocation.longitude]}
                    icon={startMarkerIcon}
                  />
                )}

                {session.endLocation && (
                  <Marker
                    position={[session.endLocation.latitude, session.endLocation.longitude]}
                    icon={endMarkerIcon}
                  />
                )}
              </MapContainer>
            ) : (
              <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-500 text-sm">
                No GPS map path recorded for this session.
              </div>
            )}
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1 text-slate-400 mb-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Total Distance
              </span>
              <span className="text-base font-bold text-slate-100">
                {session.totalDistanceMeters.toFixed(2)} m
              </span>
              <div className="text-slate-500">{session.totalDistanceKm.toFixed(3)} km</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1 text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-purple-400" /> Duration
              </span>
              <span className="text-base font-bold font-mono text-slate-100">
                {formatDuration(session.durationSeconds)}
              </span>
              <div className="text-slate-500">{session.totalGPSPoints} GPS Points</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1 text-slate-400 mb-1">
                <Gauge className="w-3.5 h-3.5 text-amber-400" /> Speed (Avg / Max)
              </span>
              <span className="text-base font-bold text-slate-100">
                {session.averageSpeedKmH.toFixed(1)} km/h
              </span>
              <div className="text-slate-500">Max: {session.maxSpeedKmH.toFixed(1)} km/h</div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1 text-slate-400 mb-1">
                <Compass className="w-3.5 h-3.5 text-indigo-400" /> Avg Accuracy
              </span>
              <span className="text-base font-bold text-slate-100">
                ±{session.averageAccuracyMeters.toFixed(1)} m
              </span>
              <div className="text-slate-500">Filtered GPS Points</div>
            </div>
          </div>

          {/* Coordinates Summary */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-cyan-400" /> Start & End Coordinates
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800/60">
                <div className="text-emerald-400 font-semibold mb-0.5">Start Coordinate:</div>
                {session.startLocation
                  ? `${session.startLocation.latitude.toFixed(6)}, ${session.startLocation.longitude.toFixed(6)}`
                  : 'N/A'}
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800/60">
                <div className="text-rose-400 font-semibold mb-0.5">End Coordinate:</div>
                {session.endLocation
                  ? `${session.endLocation.latitude.toFixed(6)}, ${session.endLocation.longitude.toFixed(6)}`
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
