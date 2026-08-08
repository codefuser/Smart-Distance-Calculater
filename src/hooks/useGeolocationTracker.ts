import { useState, useRef, useCallback, useEffect } from 'react';
import { GPSPoint, TrackingStatus, AccuracyQuality, GPSSignalStatus, RouteMark } from '../types';
import {
  validateGPSPointAdvanced,
  getAccuracyQuality,
  getGPSSignalStatus,
  StationaryDetector,
} from '../utils/gpsFilter';

export interface UseGeolocationTrackerReturn {
  currentLocation: GPSPoint | null;
  startLocation: GPSPoint | null;
  lastLocation: GPSPoint | null;
  path: GPSPoint[];
  marks: RouteMark[];
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
  addMark: (note?: string) => RouteMark | null;
  updateMarkNote: (id: string, note: string) => void;
}

export function useGeolocationTracker(): UseGeolocationTrackerReturn {
  // Tracking State
  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null);
  const [startLocation, setStartLocation] = useState<GPSPoint | null>(null);
  const [lastLocation, setLastLocation] = useState<GPSPoint | null>(null);
  const [path, setPath] = useState<GPSPoint[]>([]);
  const [marks, setMarks] = useState<RouteMark[]>([]);
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
  const marksRef = useRef<RouteMark[]>([]);
  const totalDistanceMetersRef = useRef<number>(0);
  const speedRef = useRef<number | null>(null);
  const stationaryDetectorRef = useRef<StationaryDetector>(new StationaryDetector());

  // Sync refs with state
  useEffect(() => {
    totalDistanceMetersRef.current = totalDistanceMeters;
  }, [totalDistanceMeters]);

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
      setCurrentLocation(freshPoint);

      // Set start location on first valid point
      setStartLocation((prevStart) => {
        if (!prevStart) return freshPoint;
        return prevStart;
      });

      // Pass fresh point into Stationary Detector for zero-lag distance calculation
      const motion = stationaryDetectorRef.current.processPoint(freshPoint);
      setSmoothedSpeed(motion.displaySpeed);
      speedRef.current = motion.displaySpeed;

      // Only accumulate distance and update path for VERIFIED MOVEMENT points
      if (motion.isVerifiedMovement) {
        if (motion.distanceDelta > 0) {
          setTotalDistanceMeters((prevDist) => {
            const next = prevDist + motion.distanceDelta;
            totalDistanceMetersRef.current = next;
            return next;
          });
        }

        // Update distance path and last verified location
        smoothedPathRef.current.push(freshPoint);
        setLastLocation(freshPoint);
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
    setMarks([]);
    setTotalDistanceMeters(0);
    setElapsedTime(0);
    setErrorMessage(null);
    setSmoothedSpeed(null);
    setTrackingStatus('idle');

    acceptedPointsRef.current = [];
    smoothedPathRef.current = [];
    recentRawPointsBufferRef.current = [];
    marksRef.current = [];
    totalDistanceMetersRef.current = 0;
    speedRef.current = null;
    stationaryDetectorRef.current.reset();
  }, [stopTracking]);

  const addMark = useCallback((note?: string): RouteMark | null => {
    const currentLoc = acceptedPointsRef.current[acceptedPointsRef.current.length - 1] || currentLocation || startLocation;
    if (!currentLoc) return null;

    const markNumber = marksRef.current.length + 1;
    const now = Date.now();
    const timeFormatted = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const prevMarkDist = marksRef.current.length > 0
      ? marksRef.current[marksRef.current.length - 1].distanceFromStartMeters
      : 0;

    const currentDist = totalDistanceMetersRef.current;
    const segmentDist = Math.max(0, currentDist - prevMarkDist);

    const speedKmH = speedRef.current !== null && speedRef.current >= 0
      ? speedRef.current * 3.6
      : (currentLoc.speed && currentLoc.speed >= 0 ? currentLoc.speed * 3.6 : 0);

    const newMark: RouteMark = {
      id: `mark_${markNumber}_${now}`,
      number: markNumber,
      timestamp: now,
      timeFormatted,
      distanceFromStartMeters: currentDist,
      segmentDistanceMeters: segmentDist,
      latitude: currentLoc.latitude,
      longitude: currentLoc.longitude,
      speedKmH: Number(speedKmH.toFixed(1)),
      accuracyMeters: Number(currentLoc.accuracy.toFixed(1)),
      note: note ? note.trim() : undefined,
    };

    const updated = [...marksRef.current, newMark];
    marksRef.current = updated;
    setMarks(updated);
    return newMark;
  }, [currentLocation, startLocation]);

  const updateMarkNote = useCallback((id: string, note: string) => {
    const updated = marksRef.current.map((m) =>
      m.id === id ? { ...m, note: note.trim() || undefined } : m
    );
    marksRef.current = updated;
    setMarks(updated);
  }, []);

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
    marks,
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
    addMark,
    updateMarkNote,
  };
}

