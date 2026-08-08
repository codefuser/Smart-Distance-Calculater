export type TransportMode = 'walking' | 'running' | 'bike' | 'car' | 'bus';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number | null;
}

export interface RouteMark {
  id: string;
  number: number;
  timestamp: number;
  timeFormatted: string;
  distanceFromStartMeters: number;
  segmentDistanceMeters: number;
  latitude: number;
  longitude: number;
  speedKmH: number;
  accuracyMeters: number;
  headingAngle?: number;
  cardinalDirection?: string;
  segmentBearing?: number;
  note?: string;
}

export type TrackingStatus = 'idle' | 'initializing' | 'tracking' | 'paused' | 'stopped' | 'error';

export type AccuracyQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export type GPSSignalStatus = 'Searching' | 'Weak Signal' | 'Good Signal' | 'Excellent Signal';

export interface DistanceMetrics {
  meters: number;
  centimeters: number;
  kilometers: number;
}

export interface DirectionalDistances {
  north: number;
  east: number;
  south: number;
  west: number;
}

export interface MeasurementSession {
  id: string;
  name: string;
  date: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  totalDistanceMeters: number;
  straightLineDistanceMeters?: number;
  directionalDistances?: DirectionalDistances;
  totalDistanceKm: number;
  averageAccuracyMeters: number;
  averageSpeedKmH: number;
  maxSpeedKmH: number;
  startLocation: { latitude: number; longitude: number } | null;
  endLocation: { latitude: number; longitude: number } | null;
  totalGPSPoints: number;
  path: GPSPoint[];
  marks?: RouteMark[];
}
