import { useState, useRef, useCallback, useEffect } from 'react';
import { GPSPoint, TrackingStatus, AccuracyQuality, GPSSignalStatus, DebugMetrics } from '../types';
import {
  validateGPSPointAdvanced,
  computeMovingAverage,
  getAccuracyQuality,
  getGPSSignalStatus,
} from '../utils/gpsFilter';
import { calculateHaversineDistance } from '../utils/haversine';

export interface UseGeolocationTrackerReturn {
  rawLocation: GPSPoint | null;
  currentLocation: GPSPoint | null;
  startLocation: GPSPoint | null;
  lastLocation: GPSPoint | null;
  path: GPSPoint[];
  totalDistanceMeters: number;
  rawDistanceMeters: number;
  elapsedTime: number;
  rawAccuracy: number | null;
  filteredAccuracy: number | null;
  gpsAccuracy: number | null;
  accuracyQuality: AccuracyQuality;
  gpsSignalStatus: GPSSignalStatus;
  speed: number | null;
  trackingStatus: TrackingStatus;
  errorMessage: string | null;
  debugMetrics: DebugMetrics;
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
}

export function useGeolocationTracker(): UseGeolocationTrackerReturn {
  // Primary State
  const [rawLocation, setRawLocation] = useState<GPSPoint | null>(null);
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

  // Tracking Refs
  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | ReturnType<typeof setInterval> | null>(null);
  const lastRawLocationRef = useRef<GPSPoint | null>(null);
  const acceptedPointsRef = useRef<GPSPoint[]>([]);
  const smoothedPathRef = useRef<GPSPoint[]>([]);
  const recentRawPointsBufferRef = useRef<GPSPoint[]>([]);

  // Immediate Position Handler
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const freshPoint: GPSPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp || Date.now(),
      speed: position.coords.speed,
    };

    // 1. ALWAYS update raw location immediately for map marker responsiveness
    setRawLocation(freshPoint);

    // Maintain recent raw buffer (last 3 points)
    recentRawPointsBufferRef.current.push(freshPoint);
    if (recentRawPointsBufferRef.current.length > 3) {
      recentRawPointsBufferRef.current.shift();
    }

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

    // 2. Validate point for distance accumulation & filtered path
    const validation = validateGPSPointAdvanced(
      freshPoint,
      acceptedPointsRef.current[acceptedPointsRef.current.length - 1] || null,
      acceptedPointsRef.current,
      recentRawPointsBufferRef.current
    );

    if (validation.isValid) {
      // Add to accepted points buffer
      acceptedPointsRef.current.push(freshPoint);
      setAcceptedCount((prev) => prev + 1);

      // Compute 5-point moving average for coordinate smoothing
      const smoothedPoint = computeMovingAverage(acceptedPointsRef.current, 5);
      setCurrentLocation(smoothedPoint);

      // Set start location on first valid point
      setStartLocation((prevStart) => {
        if (!prevStart) return smoothedPoint;
        return prevStart;
      });

      // Calculate distance increment using smoothed coordinates
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

  // Controls
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
          timeout: 10000, // Configured for immediate 10s timeout response
          maximumAge: 0,  // Always fetch fresh GPS fix
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
    setRawLocation(null);
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
    recentRawPointsBufferRef.current = [];
  }, [stopTracking]);

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

  const rawAccuracy = rawLocation ? rawLocation.accuracy : null;
  const filteredAccuracy = currentLocation ? currentLocation.accuracy : null;
  const gpsAccuracy = rawAccuracy ?? filteredAccuracy;
  const accuracyQuality = getAccuracyQuality(gpsAccuracy);
  const gpsSignalStatus = getGPSSignalStatus(gpsAccuracy);
  const speed = rawLocation ? rawLocation.speed ?? null : null;

  return {
    rawLocation,
    currentLocation,
    startLocation,
    lastLocation,
    path,
    totalDistanceMeters,
    rawDistanceMeters,
    elapsedTime,
    rawAccuracy,
    filteredAccuracy,
    gpsAccuracy,
    accuracyQuality,
    gpsSignalStatus,
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
