export type TransportMode = 'walking' | 'running' | 'bike' | 'car' | 'bus';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number | null;
}

export type TrackingStatus = 'idle' | 'tracking' | 'paused' | 'stopped' | 'error';

export interface DistanceMetrics {
  meters: number;
  centimeters: number;
  kilometers: number;
}
