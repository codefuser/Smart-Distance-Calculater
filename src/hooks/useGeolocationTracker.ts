import { useState, useRef, useCallback, useEffect } from 'react';
import { GPSPoint, TrackingStatus, AccuracyQuality, GPSSignalStatus } from '../types';
import {
  validateGPSPointAdvanced,
  computeMovingAverage,
  getAccuracyQuality,
  getGPSSignalStatus,
  StationaryDetector,
} from '../utils/gpsFilter';

export interface UseGeolocationTrackerReturn {
  currentLocation: GPSPoint | null;
  startLocation: GPSPoint | null;
  lastLocation: GPSPoint | null;
  path: GPSPoint[];
  totalDistanceMeters: number;
  elapsedTime: number;
  gpsAccuracy: number | null;
  accuracyQuality: AccuracyQuality;
  gpsSignalStatus: GPSSignalStatus;
  speed: number | null;
  trackingStatus: TrackingStatus;
  errorMessage: string | null;
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
}

export function useGeolocationTracker(): UseGeolocationTrackerReturn {
  // Tracking State
  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null);
  const [startLocation, setStartLocation] = useState<GPSPoint | null>(null);
  const [lastLocation, setLastLocation] = useState<GPSPoint | null>(null);
  const [path, setPath] = useState<GPSPoint[]>([]);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [smoothedSpeed, setSmoothedSpeed] = useState<number | null>(null);

  // Tracking Refs
  const watchIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | ReturnType<typeof setInterval> | null>(null);
  const acceptedPointsRef = useRef<GPSPoint[]>([]);
  const smoothedPathRef = useRef<GPSPoint[]>([]);
  const recentRawPointsBufferRef = useRef<GPSPoint[]>([]);
  const stationaryDetectorRef = useRef<StationaryDetector>(new StationaryDetector());

  // Position Handler
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const freshPoint: GPSPoint = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp || Date.now(),
      speed: position.coords.speed,
    };

    // Maintain recent raw buffer (last 3 points)
    recentRawPointsBufferRef.current.push(freshPoint);
    if (recentRawPointsBufferRef.current.length > 3) {
      recentRawPointsBufferRef.current.shift();
    }

    // Adaptive GPS point validation
    const validation = validateGPSPointAdvanced(
      freshPoint,
      acceptedPointsRef.current[acceptedPointsRef.current.length - 1] || null,
      acceptedPointsRef.current,
      recentRawPointsBufferRef.current
    );

    if (validation.isValid) {
      acceptedPointsRef.current.push(freshPoint);

      // Smooth coordinates using 5-point moving average for DISPLAY LOCATION
      const smoothedPoint = computeMovingAverage(acceptedPointsRef.current, 5);
      setCurrentLocation(smoothedPoint);

      // Set start location on first valid point
      setStartLocation((prevStart) => {
        if (!prevStart) return smoothedPoint;
        return prevStart;
      });

      // Pass smoothed point into Stationary Detector State Machine
      const motion = stationaryDetectorRef.current.processPoint(smoothedPoint);

      // Update speed display (0 km/h when stationary)
      setSmoothedSpeed(motion.displaySpeed);

      // Only accumulate distance and update path for VERIFIED MOVEMENT points
      if (motion.isVerifiedMovement) {
        if (motion.distanceDelta > 0) {
          setTotalDistanceMeters((prevDist) => prevDist + motion.distanceDelta);
        }

        // Update distance path and last verified location
        smoothedPathRef.current.push(smoothedPoint);
        setLastLocation(smoothedPoint);
        setPath([...smoothedPathRef.current]);
      }
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
          timeout: 10000,
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
    setElapsedTime(0);
    setErrorMessage(null);
    setSmoothedSpeed(null);
    setTrackingStatus('idle');

    acceptedPointsRef.current = [];
    smoothedPathRef.current = [];
    recentRawPointsBufferRef.current = [];
    stationaryDetectorRef.current.reset();
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

  const gpsAccuracy = currentLocation ? currentLocation.accuracy : null;
  const accuracyQuality = getAccuracyQuality(gpsAccuracy);
  const gpsSignalStatus = getGPSSignalStatus(gpsAccuracy);
  const speed = smoothedSpeed !== null ? smoothedSpeed : (currentLocation ? currentLocation.speed ?? null : null);

  return {
    currentLocation,
    startLocation,
    lastLocation,
    path,
    totalDistanceMeters,
    elapsedTime,
    gpsAccuracy,
    accuracyQuality,
    gpsSignalStatus,
    speed,
    trackingStatus,
    errorMessage,
    startTracking,
    stopTracking,
    resetTracking,
  };
}

