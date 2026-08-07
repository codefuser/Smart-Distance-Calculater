import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import { GPSPoint, TrackingStatus, GPSSignalStatus } from '../types';
import { calculateBearing } from '../utils/haversine';
import { Layers, Navigation as NavigationIcon, Compass, ZoomIn, Eye, Activity, ShieldCheck, MapPin, RotateCw, Plus, Minus } from 'lucide-react';

interface LiveMapProps {
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
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
    maxZoom: 18,
  },
  opentopo: {
    name: 'OpenTopo Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 17,
  },
  carto_voyager: {
    name: 'Carto Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
};

// DivIcons
function createNavigationArrowIcon(heading: number, counterRotation: number) {
  const totalRot = heading + counterRotation;
  return L.divIcon({
    className: 'custom-nav-heading-marker',
    html: `<div style="transform: rotate(${totalRot}deg); transition: transform 0.2s ease-out;" class="relative flex items-center justify-center w-8 h-8 drop-shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L19 21L12 17L5 21L12 2Z" fill="#3b82f6" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createFlagIcon(flagEmoji: string, bgClass: string, counterRotation: number) {
  return L.divIcon({
    className: 'custom-flag-marker',
    html: `<div style="transform: rotate(${counterRotation}deg);" class="flex items-center justify-center w-8 h-8 rounded-full ${bgClass} border-2 border-white shadow-xl text-white font-bold text-sm">
          ${flagEmoji}
        </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const startFlagIcon = (counterRot: number) => createFlagIcon('🚩', 'bg-emerald-600', counterRot);
const endFlagIcon = (counterRot: number) => createFlagIcon('🏁', 'bg-rose-600', counterRot);

interface POIItem {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: string;
}

// Map Event Listener Helper
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

// Auto follow controller
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
        duration: 0.4,
      });
    }
  }, [position, autoFollow, map]);

  return null;
}

// Custom Map Pane Rotation Controller
function MapRotationController({ rotationDeg }: { rotationDeg: number }) {
  const map = useMap();

  useEffect(() => {
    const pane = map.getPane('mapPane');
    if (pane) {
      pane.style.transformOrigin = 'center center';
      pane.style.transition = 'transform 0.3s ease-out';
      pane.style.transform = `rotate(${rotationDeg}deg)`;
    }
  }, [rotationDeg, map]);

  return null;
}

export const LiveMap: React.FC<LiveMapProps> = ({
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
  // Map Style State
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
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [mapRotation, setMapRotation] = useState<number>(0);
  const [currentZoom, setCurrentZoom] = useState<number>(18);
  const [heading, setHeading] = useState<number>(0);
  const [pois, setPois] = useState<POIItem[]>([]);
  const mapRef = useRef<L.Map | null>(null);

  const handleSelectStyle = (key: MapStyleKey) => {
    setSelectedStyleKey(key);
    setShowStyleMenu(false);
    try {
      localStorage.setItem('distance_meter_map_style', key);
    } catch {
      // ignore
    }
  };

  const activePoint = currentLocation || startLocation;

  // Heading Calculation
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

        // If Auto Rotate is ON, update map rotation underneath heading
        if (autoRotate) {
          setMapRotation(-newHeading);
        }
      }
    } else if (activePoint) {
      prevPointRef.current = activePoint;
    }
  }, [activePoint, autoRotate]);

  // Handle device orientation compass if available when autoRotate is ON
  useEffect(() => {
    if (!autoRotate) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let compassHeading: number | null = null;
      if ('webkitCompassHeading' in e && typeof e.webkitCompassHeading === 'number') {
        compassHeading = e.webkitCompassHeading;
      } else if (e.alpha !== null) {
        compassHeading = (360 - e.alpha) % 360;
      }

      if (compassHeading !== null) {
        setMapRotation(-compassHeading);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [autoRotate]);

  // Reset North (0°)
  const handleResetNorth = useCallback(() => {
    setAutoRotate(false);
    setMapRotation(0);
  }, []);

  // Fetch Nearby POIs when Zoom >= 16
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
      // ignore
    }
  }, []);

  useEffect(() => {
    if (currentZoom >= 16 && activePoint) {
      fetchPOIs(activePoint.latitude, activePoint.longitude);
    } else {
      setPois([]);
    }
  }, [currentZoom, activePoint?.latitude, activePoint?.longitude, fetchPOIs]);

  const polylinePositions: [number, number][] = path.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  const endLocation =
    trackingStatus === 'stopped' && path.length > 0
      ? path[path.length - 1]
      : null;

  const currentMarkerPosition: [number, number] | null = activePoint
    ? [activePoint.latitude, activePoint.longitude]
    : null;

  const defaultCenter: [number, number] = currentMarkerPosition || [13.0827, 80.2707];
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

  if (!currentLocation && !startLocation) {
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
    <div className="w-full h-full min-h-[320px] rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl bg-slate-950">
      {/* ---------------------------------------------------------------- */}
      {/* 1. TOP LEFT: Live Distance, Speed & GPS Accuracy Chips (Gap 12px) */}
      {/* ---------------------------------------------------------------- */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-3 pointer-events-none">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-100 text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>{totalDistanceMeters.toFixed(1)} m</span>
        </div>

        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-100 text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
          <NavigationIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>{speedKmH} km/h</span>
        </div>

        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-100 text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>{gpsAccuracy !== null ? `±${gpsAccuracy.toFixed(1)}m` : '---'}</span>
        </div>

        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 text-emerald-400 text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-lg">
          {gpsSignalStatus}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 2. TOP RIGHT: Map Style, Auto Follow, Auto Rotate, Reset North   */}
      {/* ---------------------------------------------------------------- */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col items-end gap-3">
        {/* Map Style Button & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowStyleMenu((prev) => !prev)}
            className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-xl backdrop-blur-sm transition-all"
            title="Map Style"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
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
          className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2 border shadow-xl backdrop-blur-sm transition-all ${
            autoFollow
              ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-500'
              : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
          title="Toggle Auto Follow"
        >
          <Eye className="w-4 h-4" />
          <span className="hidden sm:inline">Auto Follow: {autoFollow ? 'ON' : 'OFF'}</span>
        </button>

        {/* Auto Rotate Map Toggle Button */}
        <button
          onClick={() => {
            const nextVal = !autoRotate;
            setAutoRotate(nextVal);
            if (!nextVal) setMapRotation(0);
          }}
          className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2 border shadow-xl backdrop-blur-sm transition-all ${
            autoRotate
              ? 'bg-indigo-600/90 hover:bg-indigo-500 text-white border-indigo-500'
              : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
          title="Toggle Auto Rotate Map"
        >
          <RotateCw className="w-4 h-4" />
          <span className="hidden sm:inline">Auto Rotate: {autoRotate ? 'ON' : 'OFF'}</span>
        </button>

        {/* Reset North / Compass Button */}
        <button
          onClick={handleResetNorth}
          className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-xl backdrop-blur-sm transition-all"
          title="Reset North (0°)"
        >
          <div
            style={{ transform: `rotate(${-mapRotation}deg)`, transition: 'transform 0.3s ease-out' }}
          >
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="hidden sm:inline">
            {mapRotation === 0 ? 'North' : `${Math.abs(Math.round(mapRotation))}°`}
          </span>
        </button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 3. BOTTOM RIGHT: Re-center & Zoom Level Indicator (Gap 12px)     */}
      {/* ---------------------------------------------------------------- */}
      <div className="absolute bottom-4 right-3 z-[400] flex flex-col items-end gap-3">
        {/* Re-center Button */}
        <button
          onClick={() => {
            setAutoFollow(true);
            if (mapRef.current && currentMarkerPosition) {
              mapRef.current.panTo(currentMarkerPosition, { animate: true, duration: 0.4 });
            }
          }}
          className={`px-3 py-2 rounded-lg font-semibold text-xs border shadow-xl backdrop-blur-sm flex items-center gap-2 transition-all ${
            !autoFollow
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 animate-bounce'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
          title="Re-center map"
        >
          <MapPin className="w-4 h-4 text-emerald-300" />
          <span>Re-center</span>
        </button>

        {/* Zoom Level Indicator */}
        <div className="bg-slate-950/90 border border-slate-800 text-slate-300 text-[11px] font-mono px-2.5 py-1.5 rounded-lg shadow-xl backdrop-blur-sm flex items-center gap-1.5">
          <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
          <span>Zoom: {currentZoom}</span>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 4. BOTTOM LEFT: Zoom (+ / -) Control Buttons (Gap 12px)           */}
      {/* ---------------------------------------------------------------- */}
      <div className="absolute bottom-4 left-3 z-[400] flex flex-col gap-2">
        <button
          onClick={() => {
            if (mapRef.current) mapRef.current.zoomIn();
          }}
          className="w-9 h-9 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-100 rounded-lg shadow-xl flex items-center justify-center backdrop-blur-sm transition-colors active:scale-95"
          title="Zoom In"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            if (mapRef.current) mapRef.current.zoomOut();
          }}
          className="w-9 h-9 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-100 rounded-lg shadow-xl flex items-center justify-center backdrop-blur-sm transition-colors active:scale-95"
          title="Zoom Out"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Leaflet Map Engine Container                                     */}
      {/* ---------------------------------------------------------------- */}
      <MapContainer
        ref={mapRef}
        center={defaultCenter}
        zoom={18}
        zoomControl={false}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          key={selectedStyleKey}
          attribution={currentStyleConfig.attribution}
          url={currentStyleConfig.url}
          maxZoom={currentStyleConfig.maxZoom}
        />

        <MapEventsHandler
          onUserDrag={() => setAutoFollow(false)}
          onZoomChange={(zoom) => setCurrentZoom(zoom)}
        />

        <AutoFollowController position={currentMarkerPosition} autoFollow={autoFollow} />

        <MapRotationController rotationDeg={mapRotation} />

        {/* Travel Path Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: '#10b981',
              weight: 6,
              opacity: 0.95,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
        )}

        {/* Start Flag Marker */}
        {startLocation && (
          <Marker
            position={[startLocation.latitude, startLocation.longitude]}
            icon={startFlagIcon(-mapRotation)}
          >
            <Popup>
              <div className="text-xs font-bold text-emerald-600">Start Point</div>
            </Popup>
          </Marker>
        )}

        {/* End Flag Marker */}
        {endLocation && trackingStatus === 'stopped' && (
          <Marker
            position={[endLocation.latitude, endLocation.longitude]}
            icon={endFlagIcon(-mapRotation)}
          >
            <Popup>
              <div className="text-xs font-bold text-rose-600">End Point</div>
            </Popup>
          </Marker>
        )}

        {/* Current Navigation Arrow Marker */}
        {currentMarkerPosition && (
          <Marker
            position={currentMarkerPosition}
            icon={createNavigationArrowIcon(heading, -mapRotation)}
          />
        )}

        {/* Nearby POIs */}
        {currentZoom >= 16 &&
          pois.map((poi) => (
            <Marker key={`poi_${poi.id}`} position={[poi.lat, poi.lon]} icon={L.divIcon({
              className: 'custom-poi-marker',
              html: `<div style="transform: rotate(${-mapRotation}deg);" class="w-6 h-6 rounded-full bg-amber-500/90 border border-amber-200 flex items-center justify-center text-[10px] shadow text-slate-950 font-bold">📍</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}>
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
