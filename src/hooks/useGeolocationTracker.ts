import { useState, useRef, useCallback, useEffect } from 'react';
import { GPSPoint, TrackingStatus } from '../types';
import { validateGPSPoint } from '../utils/gpsFilter';

export interface UseGeolocationTrackerReturn {
  currentLocation: GPSPoint | null;
  startLocation: GPSPoint | null;
  lastLocation: GPSPoint | null;
  path: GPSPoint[];
  totalDistanceMeters: number;
  elapsedTime: number;
  gpsAccuracy: number | null;
  speed: number | null;
  trackingStatus: TrackingStatus;
  errorMessage: string | null;
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
}

/**
 * Custom React hook for continuous high-accuracy live GPS location tracking
 * with automatic noise filtering and Haversine distance accumulation.
 */
export function useGeolocationTracker(): UseGeolocationTrackerReturn {
  // Application State
  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null);
  const [startLocation, setStartLocation] = useState<GPSPoint | null>(null);
  const [lastLocation, setLastLocation] = useState<GPSPoint | null>(null);
  const [path, setPath] = useState<GPSPoint[]>([]);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References for active tracking processes & refs to avoid stale closure issues
  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | ReturnType<typeof setInterval> | null>(null);
  const lastLocationRef = useRef<GPSPoint | null>(null);

  // Keep lastLocationRef synced with state
  useEffect(() => {
    lastLocationRef.current = lastLocation;
  }, [lastLocation]);

  // Handle incoming position updates from navigator.geolocation.watchPosition
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const freshPoint: GPSPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp || Date.now(),
      speed: position.coords.speed,
    };

    // Always update raw current location & accuracy for real-time map indicator
    setCurrentLocation(freshPoint);

    // Validate the point against noise filters using the previous valid point
    const validation = validateGPSPoint(freshPoint, lastLocationRef.current);

    if (validation.isValid) {
      // 1. Set start location if this is the first valid point
      setStartLocation((prevStart) => {
        if (!prevStart) return freshPoint;
        return prevStart;
      });

      // 2. Accumulate valid movement distance
      if (validation.distanceDelta > 0) {
        setTotalDistanceMeters((prevDist) => prevDist + validation.distanceDelta);
      }

      // 3. Update last valid location and append to travel path
      setLastLocation(freshPoint);
      setPath((prevPath) => [...prevPath, freshPoint]);
    }
  }, []);

  // Handle Geolocation Errors
  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    let msg = 'Failed to obtain GPS position.';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        msg = 'GPS permission was denied by the user.';
        break;
      case error.POSITION_UNAVAILABLE:
        msg = 'GPS position information is unavailable.';
        break;
      case error.TIMEOUT:
        msg = 'GPS location request timed out.';
        break;
    }
    setErrorMessage(msg);
    setTrackingStatus('error');
  }, []);

  // Start continuous GPS tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation API is not supported by your browser.');
      setTrackingStatus('error');
      return;
    }

    // Reset error state and update status
    setErrorMessage(null);
    setTrackingStatus('tracking');

    // Start timer interval for elapsed tracking time
    if (!timerIdRef.current) {
      timerIdRef.current = setInterval(() => {
        setElapsedTime((prevSeconds) => prevSeconds + 1);
      }, 1000);
    }

    // Initiate continuous live position watching
    if (watchIdRef.current === null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handlePositionError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    }
  }, [handlePositionUpdate, handlePositionError]);

  // Stop continuous GPS tracking and freeze distance
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (timerIdRef.current !== null) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }

    setTrackingStatus('stopped');
  }, []);

  // Reset tracking engine to initial clean state
  const resetTracking = useCallback(() => {
    stopTracking();
    setCurrentLocation(null);
    setStartLocation(null);
    setLastLocation(null);
    setPath([]);
    setTotalDistanceMeters(0);
    setElapsedTime(0);
    setErrorMessage(null);
    setTrackingStatus('idle');
  }, [stopTracking]);

  // Cleanup watcher and timer on hook unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerIdRef.current !== null) {
        clearInterval(timerIdRef.current);
      }
    };
  }, []);

  // Derived properties
  const gpsAccuracy = currentLocation ? currentLocation.accuracy : null;
  const speed = currentLocation ? currentLocation.speed ?? null : null;

  return {
    currentLocation,
    startLocation,
    lastLocation,
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
  };
}
