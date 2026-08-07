import { useState, useRef, useCallback, useEffect } from 'react';
import { GPSPoint, TrackingStatus, AccuracyQuality, DebugMetrics } from '../types';
import {
  validateGPSPointAdvanced,
  computeMovingAverage,
  getAccuracyQuality,
} from '../utils/gpsFilter';
import { calculateHaversineDistance } from '../utils/haversine';

export interface UseGeolocationTrackerReturn {
  currentLocation: GPSPoint | null;
  startLocation: GPSPoint | null;
  lastLocation: GPSPoint | null;
  path: GPSPoint[];
  totalDistanceMeters: number;
  rawDistanceMeters: number;
  elapsedTime: number;
  gpsAccuracy: number | null;
  accuracyQuality: AccuracyQuality;
  speed: number | null;
  trackingStatus: TrackingStatus;
  errorMessage: string | null;
  debugMetrics: DebugMetrics;
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
}

export function useGeolocationTracker(): UseGeolocationTrackerReturn {
  // Primary Tracking State
  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null);
  const [startLocation, setStartLocation] = useState<GPSPoint | null>(null);
  const [lastLocation, setLastLocation] = useState<GPSPoint | null>(null);
  const [path, setPath] = useState<GPSPoint[]>([]);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number>(0);
  const [rawDistanceMeters, setRawDistanceMeters] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debug Metrics State
  const [acceptedCount, setAcceptedCount] = useState<number>(0);
  const [rejectedCount, setRejectedCount] = useState<number>(0);
  const [lastRejectionReason, setLastRejectionReason] = useState<string | null>(null);
  const [lastMovementDelta, setLastMovementDelta] = useState<number>(0);

  // Refs for tracking processes to avoid closure lag
  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | ReturnType<typeof setInterval> | null>(null);
  const lastRawLocationRef = useRef<GPSPoint | null>(null);
  const acceptedPointsRef = useRef<GPSPoint[]>([]);
  const smoothedPathRef = useRef<GPSPoint[]>([]);

  // Position Update Handler
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const freshPoint: GPSPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp || Date.now(),
      speed: position.coords.speed,
    };

    setCurrentLocation(freshPoint);

    // Calculate raw distance regardless of filters for debug comparison
    if (lastRawLocationRef.current) {
      const rawDelta = calculateHaversineDistance(
        lastRawLocationRef.current.latitude,
        lastRawLocationRef.current.longitude,
        freshPoint.latitude,
        freshPoint.longitude
      );
      if (rawDelta > 0) {
        setRawDistanceMeters((prev) => prev + rawDelta);
      }
    }
    lastRawLocationRef.current = freshPoint;

    // Advanced Adaptive Validation
    const validation = validateGPSPointAdvanced(
      freshPoint,
      acceptedPointsRef.current[acceptedPointsRef.current.length - 1] || null,
      acceptedPointsRef.current
    );

    if (validation.isValid) {
      // Add to accepted points buffer
      acceptedPointsRef.current.push(freshPoint);
      setAcceptedCount((prev) => prev + 1);

      // Compute 5-point moving average for noise smoothing
      const smoothedPoint = computeMovingAverage(acceptedPointsRef.current, 5);

      // Set start location on first valid point
      setStartLocation((prevStart) => {
        if (!prevStart) return smoothedPoint;
        return prevStart;
      });

      // Calculate distance increment using smoothed coordinates to prevent spikes
      const lastSmoothed = smoothedPathRef.current[smoothedPathRef.current.length - 1];
      let distanceIncrement = 0;

      if (lastSmoothed) {
        distanceIncrement = calculateHaversineDistance(
          lastSmoothed.latitude,
          lastSmoothed.longitude,
          smoothedPoint.latitude,
          smoothedPoint.longitude
        );
      }

      setLastMovementDelta(distanceIncrement);

      if (distanceIncrement > 0) {
        setTotalDistanceMeters((prevDist) => prevDist + distanceIncrement);
      }

      // Update smoothed path and last valid point
      smoothedPathRef.current.push(smoothedPoint);
      setLastLocation(smoothedPoint);
      setPath([...smoothedPathRef.current]);
    } else {
      setRejectedCount((prev) => prev + 1);
      setLastRejectionReason(validation.reason || 'Failed validation');
    }
  }, []);

  // Geolocation Error Handler
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

  // Control Functions
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation API is not supported by your browser.');
      setTrackingStatus('error');
      return;
    }

    setErrorMessage(null);
    setTrackingStatus('tracking');

    if (!timerIdRef.current) {
      timerIdRef.current = setInterval(() => {
        setElapsedTime((prevSeconds) => prevSeconds + 1);
      }, 1000);
    }

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

  const resetTracking = useCallback(() => {
    stopTracking();
    setCurrentLocation(null);
    setStartLocation(null);
    setLastLocation(null);
    setPath([]);
    setTotalDistanceMeters(0);
    setRawDistanceMeters(0);
    setElapsedTime(0);
    setAcceptedCount(0);
    setRejectedCount(0);
    setLastRejectionReason(null);
    setLastMovementDelta(0);
    setErrorMessage(null);
    setTrackingStatus('idle');

    acceptedPointsRef.current = [];
    smoothedPathRef.current = [];
    lastRawLocationRef.current = null;
  }, [stopTracking]);

  // Unmount Cleanup
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

  const gpsAccuracy = currentLocation ? currentLocation.accuracy : null;
  const accuracyQuality = getAccuracyQuality(gpsAccuracy);
  const speed = currentLocation ? currentLocation.speed ?? null : null;

  return {
    currentLocation,
    startLocation,
    lastLocation,
    path,
    totalDistanceMeters,
    rawDistanceMeters,
    elapsedTime,
    gpsAccuracy,
    accuracyQuality,
    speed,
    trackingStatus,
    errorMessage,
    debugMetrics: {
      acceptedCount,
      rejectedCount,
      lastRejectionReason,
      rawDistanceMeters,
      lastMovementDelta,
    },
    startTracking,
    stopTracking,
    resetTracking,
  };
}
