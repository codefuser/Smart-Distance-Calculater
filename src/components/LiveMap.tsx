import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { GPSPoint, TrackingStatus, GPSSignalStatus } from '../types';
import { calculateBearing } from '../utils/haversine';
import { Layers, Navigation as NavigationIcon, Compass, ZoomIn, Eye, Activity, ShieldCheck, MapPin } from 'lucide-react';

interface LiveMapProps {
  rawLocation: GPSPoint | null;
  currentLocation: GPSPoint | null;
  startLocation: GPSPoint | null;
  path: GPSPoint[];
  totalDistanceMeters?: number;
  gpsAccuracy?: number | null;
  speed?: number | null;
  gpsSignalStatus?: GPSSignalStatus;
  trackingStatus: TrackingStatus;
  errorMessage: string | null;
}

export type MapStyleKey = 'osm' | 'carto_dark' | 'esri_satellite' | 'opentopo' | 'carto_voyager';

interface MapStyleConfig {
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

const MAP_STYLES: Record<MapStyleKey, MapStyleConfig> = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  carto_dark: {
    name: 'Carto Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  esri_satellite: {
    name: 'Esri Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
  },
  opentopo: {
    name: 'OpenTopo Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
  carto_voyager: {
    name: 'Carto Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
};

// ----------------------------------------------------
// Custom Icons (DivIcons)
// ----------------------------------------------------

// 1. Navigation Arrow Icon (Current Position with smooth CSS rotation)
function createNavigationArrowIcon(heading: number) {
  return L.divIcon({
    className: 'custom-nav-heading-marker',
    html: `<div style="transform: rotate(${heading}deg); transition: transform 0.3s ease-out;" class="relative flex items-center justify-center w-8 h-8 drop-shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L19 21L12 17L5 21L12 2Z" fill="#3b82f6" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// 2. Start Flag Icon (Green Flag)
const startFlagIcon = L.divIcon({
  className: 'custom-start-flag-marker',
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-xl text-white font-bold text-sm">
          🚩
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// 3. End Flag Icon (Red Flag)
const endFlagIcon = L.divIcon({
  className: 'custom-end-flag-marker',
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-rose-600 border-2 border-white shadow-xl text-white font-bold text-sm">
          🏁
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// 4. Raw Unfiltered GPS Marker (Light Gray Dot)
const rawLocationIcon = L.divIcon({
  className: 'custom-raw-marker',
  html: `<div class="relative flex items-center justify-center w-4 h-4 opacity-75">
          <span class="inline-flex w-3 h-3 rounded-full bg-slate-400 border border-slate-900 shadow"></span>
        </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// 5. POI Icon (Yellow Pin)
const poiIcon = L.divIcon({
  className: 'custom-poi-marker',
  html: `<div class="w-6 h-6 rounded-full bg-amber-500/90 border border-amber-200 flex items-center justify-center text-[10px] shadow text-slate-950 font-bold">
          📍
        </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface POIItem {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: string;
}

// ----------------------------------------------------
// Map Event Listener Helper (Auto-follow drag & zoom tracking)
// ----------------------------------------------------
function MapEventsHandler({
  onUserDrag,
  onZoomChange,
}: {
  onUserDrag: () => void;
  onZoomChange: (zoom: number) => void;
}) {
  useMapEvents({
    dragstart: () => {
      onUserDrag();
    },
    zoomend: (e) => {
      onZoomChange(e.target.getZoom());
    },
  });

  return null;
}

// Auto follow panner component
function AutoFollowController({
  position,
  autoFollow,
}: {
  position: [number, number] | null;
  autoFollow: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (autoFollow && position) {
      map.panTo(position, {
        animate: true,
        duration: 0.6,
      });
    }
  }, [position, autoFollow, map]);

  return null;
}

// ----------------------------------------------------
// Main Component
// ----------------------------------------------------
export const LiveMap: React.FC<LiveMapProps> = ({
  rawLocation,
  currentLocation,
  startLocation,
  path,
  totalDistanceMeters = 0,
  gpsAccuracy = null,
  speed = null,
  gpsSignalStatus = 'Searching',
  trackingStatus,
  errorMessage,
}) => {
  // Map Tile Style State (Persisted in LocalStorage)
  const [selectedStyleKey, setSelectedStyleKey] = useState<MapStyleKey>(() => {
    try {
      const saved = localStorage.getItem('distance_meter_map_style');
      if (saved && saved in MAP_STYLES) return saved as MapStyleKey;
    } catch {
      // fallback
    }
    return 'osm';
  });

  const [showStyleMenu, setShowStyleMenu] = useState<boolean>(false);

  // Auto Follow & Zoom State
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [currentZoom, setCurrentZoom] = useState<number>(18);
  const [heading, setHeading] = useState<number>(0);

  // Smooth Marker Animation State (requestAnimationFrame LERP)
  const [animatedPosition, setAnimatedPosition] = useState<[number, number] | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const animStartPosRef = useRef<[number, number] | null>(null);
  const animTargetPosRef = useRef<[number, number] | null>(null);
  const animStartTimeRef = useRef<number>(0);

  // POIs State
  const [pois, setPois] = useState<POIItem[]>([]);
  const mapRef = useRef<L.Map | null>(null);

  // Persist Map Style choice
  const handleSelectStyle = (key: MapStyleKey) => {
    setSelectedStyleKey(key);
    setShowStyleMenu(false);
    try {
      localStorage.setItem('distance_meter_map_style', key);
    } catch {
      // ignore
    }
  };

  // Determine active target coordinate (prioritize filtered location, fallback to raw)
  const activePoint = currentLocation || rawLocation || startLocation;

  // 1. Heading Rotation Calculation
  const prevPointRef = useRef<GPSPoint | null>(null);
  useEffect(() => {
    if (activePoint && prevPointRef.current) {
      const distMoved = L.latLng(activePoint.latitude, activePoint.longitude).distanceTo(
        L.latLng(prevPointRef.current.latitude, prevPointRef.current.longitude)
      );

      if (distMoved >= 0.5) {
        const newHeading = calculateBearing(
          prevPointRef.current.latitude,
          prevPointRef.current.longitude,
          activePoint.latitude,
          activePoint.longitude
        );
        setHeading(newHeading);
        prevPointRef.current = activePoint;
      }
    } else if (activePoint) {
      prevPointRef.current = activePoint;
    }
  }, [activePoint]);

  // 2. Smooth Marker LERP Animation (500ms - 800ms)
  useEffect(() => {
    if (!activePoint) return;

    const targetPos: [number, number] = [activePoint.latitude, activePoint.longitude];

    if (!animatedPosition) {
      setAnimatedPosition(targetPos);
      animStartPosRef.current = targetPos;
      animTargetPosRef.current = targetPos;
      return;
    }

    const startPos = animatedPosition;
    animStartPosRef.current = startPos;
    animTargetPosRef.current = targetPos;
    animStartTimeRef.current = performance.now();
    const DURATION = 600; // 600ms smooth movement duration

    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }

    const step = (currentTime: number) => {
      const elapsed = currentTime - animStartTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);

      // Ease-out quadratic function
      const easeProgress = 1 - (1 - progress) * (1 - progress);

      if (animStartPosRef.current && animTargetPosRef.current) {
        const lat =
          animStartPosRef.current[0] +
          (animTargetPosRef.current[0] - animStartPosRef.current[0]) * easeProgress;
        const lng =
          animStartPosRef.current[1] +
          (animTargetPosRef.current[1] - animStartPosRef.current[1]) * easeProgress;

        setAnimatedPosition([lat, lng]);
      }

      if (progress < 1) {
        animFrameIdRef.current = requestAnimationFrame(step);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [activePoint?.latitude, activePoint?.longitude]);

  // 3. Fetch Nearby POIs via Overpass API when Zoom >= 16
  const fetchPOIs = useCallback(async (lat: number, lon: number) => {
    try {
      const query = `[out:json][timeout:10];node(around:500,${lat},${lon})[amenity];out 15;`;
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.elements) {
        const parsed: POIItem[] = data.elements
          .filter((e: any) => e.tags && e.tags.name)
          .map((e: any) => ({
            id: e.id,
            lat: e.lat,
            lon: e.lon,
            name: e.tags.name,
            type: e.tags.amenity || 'Place',
          }));
        setPois(parsed);
      }
    } catch {
      // ignore fetch errors
    }
  }, []);

  useEffect(() => {
    if (currentZoom >= 16 && activePoint) {
      fetchPOIs(activePoint.latitude, activePoint.longitude);
    } else {
      setPois([]);
    }
  }, [currentZoom, activePoint?.latitude, activePoint?.longitude, fetchPOIs]);

  // Map Polyline Positions
  const polylinePositions: [number, number][] = path.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  const endLocation =
    trackingStatus === 'stopped' && path.length > 0
      ? path[path.length - 1]
      : null;

  const defaultCenter: [number, number] = animatedPosition || [13.0827, 80.2707];

  const currentStyleConfig = MAP_STYLES[selectedStyleKey];

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

  if (!rawLocation && !currentLocation && !startLocation) {
    return (
      <div className="w-full h-full min-h-[300px] bg-slate-900 flex flex-col items-center justify-center p-6 text-center rounded-xl border border-slate-800">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-slate-400 text-sm font-medium">Acquiring GPS Signal...</p>
        <p className="text-slate-500 text-xs mt-1">Please ensure location permissions are granted.</p>
      </div>
    );
  }

  const speedKmH = speed !== null && speed >= 0 ? (speed * 3.6).toFixed(1) : '0.0';

  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl">
      {/* -------------------------------------------------- */}
      {/* Top Left: Live Information Chips Overlay on Map    */}
      {/* -------------------------------------------------- */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-1.5 pointer-events-none">
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-100 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>{totalDistanceMeters.toFixed(1)} m</span>
        </div>

        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-100 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
          <NavigationIcon className="w-3 h-3 text-amber-400" />
          <span>{speedKmH} km/h</span>
        </div>

        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-100 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
          <ShieldCheck className="w-3 h-3 text-indigo-400" />
          <span>{gpsAccuracy !== null ? `±${gpsAccuracy.toFixed(1)}m` : '---'}</span>
        </div>

        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 text-emerald-400 text-[10px] font-semibold px-2 py-1 rounded-full shadow">
          {gpsSignalStatus}
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* Top Right: Map Style Selector & Auto Follow Toggle */}
      {/* -------------------------------------------------- */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        {/* Style Selector Button & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowStyleMenu((prev) => !prev)}
            className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-all"
            title="Change Map Tile Style"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{currentStyleConfig.name}</span>
          </button>

          {showStyleMenu && (
            <div className="absolute right-0 mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1 z-50 text-xs space-y-0.5">
              {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleSelectStyle(key)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors ${
                    selectedStyleKey === key
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {MAP_STYLES[key].name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auto Follow Toggle Button */}
        <button
          onClick={() => setAutoFollow((prev) => !prev)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 border shadow-lg backdrop-blur-sm transition-all ${
            autoFollow
              ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-500'
              : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
          title="Toggle Auto Follow Location"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Auto Follow: {autoFollow ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* -------------------------------------------------- */}
      {/* Bottom Right: Compass, Re-center & Zoom Controls  */}
      {/* -------------------------------------------------- */}
      <div className="absolute bottom-6 right-3 z-[400] flex flex-col items-end gap-2">
        {/* Re-center Button (Pulsing if Auto Follow is OFF) */}
        {(!autoFollow || animatedPosition) && (
          <button
            onClick={() => {
              setAutoFollow(true);
              if (mapRef.current && animatedPosition) {
                mapRef.current.panTo(animatedPosition, { animate: true, duration: 0.6 });
              }
            }}
            className={`px-3 py-2 rounded-lg font-semibold text-xs border shadow-xl backdrop-blur-sm flex items-center gap-1.5 transition-all ${
              !autoFollow
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 animate-bounce'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
            title="Re-center map on current position"
          >
            <MapPin className="w-4 h-4 text-emerald-300" />
            <span>Re-center</span>
          </button>
        )}

        {/* Compass Button (Resets map bearing orientation to North) */}
        <button
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.setZoom(18);
            }
          }}
          className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white shadow-lg backdrop-blur-sm transition-colors"
          title="Reset View & Zoom"
        >
          <Compass className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Current Zoom Level Indicator */}
        <div className="bg-slate-950/80 border border-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded shadow backdrop-blur-sm flex items-center gap-1">
          <ZoomIn className="w-3 h-3 text-slate-500" />
          <span>Zoom: {currentZoom}</span>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* Leaflet Map Engine Container                       */}
      {/* -------------------------------------------------- */}
      <MapContainer
        ref={mapRef}
        center={defaultCenter}
        zoom={18}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        {/* Dynamic Tile Layer according to selected style */}
        <TileLayer
          key={selectedStyleKey}
          attribution={currentStyleConfig.attribution}
          url={currentStyleConfig.url}
          maxZoom={currentStyleConfig.maxZoom}
        />

        {/* Event Handlers */}
        <MapEventsHandler
          onUserDrag={() => setAutoFollow(false)}
          onZoomChange={(zoom) => setCurrentZoom(zoom)}
        />

        {/* Auto Follow Controller */}
        <AutoFollowController position={animatedPosition} autoFollow={autoFollow} />

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

        {/* Accepted Points (Small Green Dots along path) */}
        {path.map((pt, idx) => (
          <CircleMarker
            key={`acc_${idx}_${pt.timestamp}`}
            center={[pt.latitude, pt.longitude]}
            radius={3}
            pathOptions={{ color: '#059669', fillColor: '#10b981', fillOpacity: 0.8 }}
          />
        ))}

        {/* Start Flag Marker (Green Flag) */}
        {startLocation && (
          <Marker
            position={[startLocation.latitude, startLocation.longitude]}
            icon={startFlagIcon}
          >
            <Popup>
              <div className="text-xs font-bold text-emerald-600">Start Location</div>
            </Popup>
          </Marker>
        )}

        {/* End Flag Marker (Red Flag) */}
        {endLocation && trackingStatus === 'stopped' && (
          <Marker
            position={[endLocation.latitude, endLocation.longitude]}
            icon={endFlagIcon}
          >
            <Popup>
              <div className="text-xs font-bold text-rose-600">End Location</div>
            </Popup>
          </Marker>
        )}

        {/* Raw Unfiltered GPS Location Marker (Light Gray Dot) */}
        {rawLocation && (
          <Marker
            position={[rawLocation.latitude, rawLocation.longitude]}
            icon={rawLocationIcon}
          />
        )}

        {/* Smooth Current Position Marker (Blue Navigation Arrow with Heading Rotation) */}
        {animatedPosition && (
          <Marker
            position={animatedPosition}
            icon={createNavigationArrowIcon(heading)}
          />
        )}

        {/* Nearby POIs (When Zoom >= 16) */}
        {currentZoom >= 16 &&
          pois.map((poi) => (
            <Marker key={`poi_${poi.id}`} position={[poi.lat, poi.lon]} icon={poiIcon}>
              <Popup>
                <div className="text-xs">
                  <div className="font-bold text-slate-800">{poi.name}</div>
                  <div className="text-slate-500 capitalize">{poi.type}</div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
};
