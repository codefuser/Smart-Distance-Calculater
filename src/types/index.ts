export type TransportMode = 'walking' | 'running' | 'bike' | 'car' | 'bus';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number | null;
}

export type TrackingStatus = 'idle' | 'tracking' | 'paused' | 'stopped' | 'error';

export type AccuracyQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export interface DistanceMetrics {
  meters: number;
  centimeters: number;
  kilometers: number;
}

export interface DebugMetrics {
  acceptedCount: number;
  rejectedCount: number;
  lastRejectionReason: string | null;
  rawDistanceMeters: number;
  lastMovementDelta: number;
}

export interface MeasurementSession {
  id: string;
  name: string;
  date: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  totalDistanceMeters: number;
  totalDistanceKm: number;
  averageAccuracyMeters: number;
  averageSpeedKmH: number;
  maxSpeedKmH: number;
  startLocation: { latitude: number; longitude: number } | null;
  endLocation: { latitude: number; longitude: number } | null;
  totalGPSPoints: number;
  path: GPSPoint[];
}
