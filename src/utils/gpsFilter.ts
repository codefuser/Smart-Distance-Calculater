import { GPSPoint, AccuracyQuality, GPSSignalStatus } from '../types';
import { calculateHaversineDistance, calculateBearing, calculateAngleDifference } from './haversine';

export interface ValidationResult {
  isValid: boolean;
  distanceDelta: number;
  reason?: string;
}

/**
 * Returns accuracy quality tier based on GPS error radius in meters.
 */
export function getAccuracyQuality(accuracy: number | null): AccuracyQuality {
  if (accuracy === null || accuracy > 50) return 'Poor';
  if (accuracy <= 10) return 'Excellent';
  if (accuracy <= 30) return 'Good';
  return 'Fair';
}

/**
 * Returns GPS signal status string for live indicator.
 */
export function getGPSSignalStatus(accuracy: number | null): GPSSignalStatus {
  if (accuracy === null) return 'Searching';
  if (accuracy <= 10) return 'Excellent Signal';
  if (accuracy <= 30) return 'Good Signal';
  return 'Weak Signal';
}

/**
 * Computes moving average smoothing across the last N accepted points (default: 5 points).
 */
export function computeMovingAverage(acceptedPoints: GPSPoint[], windowSize = 5): GPSPoint {
  if (acceptedPoints.length === 0) {
    throw new Error('Cannot compute moving average of empty points');
  }

  const recent = acceptedPoints.slice(-windowSize);
  const count = recent.length;

  const sumLat = recent.reduce((sum, p) => sum + p.latitude, 0);
  const sumLng = recent.reduce((sum, p) => sum + p.longitude, 0);

  const lastPoint = recent[recent.length - 1];

  return {
    latitude: sumLat / count,
    longitude: sumLng / count,
    accuracy: lastPoint.accuracy,
    timestamp: lastPoint.timestamp,
    speed: lastPoint.speed,
  };
}

/**
 * Validates incoming raw GPS point with adaptive accuracy filtering (0-10m, 10-30m, 30-50m, >50m),
 * 0.5m movement threshold, directional consistency, and realistic speed bounds.
 */
export function validateGPSPointAdvanced(
  newPoint: GPSPoint,
  lastPoint: GPSPoint | null,
  previousPath: GPSPoint[] = [],
  recentRawPointsBuffer: GPSPoint[] = [],
  maxSpeedKmH = 250
): ValidationResult {
  // 1. Hard cutoff for accuracy > 50 meters
  if (newPoint.accuracy > 50) {
    return {
      isValid: false,
      distanceDelta: 0,
      reason: `Accuracy too low (${newPoint.accuracy.toFixed(1)}m > 50m limit)`,
    };
  }

  // First point passes initial validation if accuracy <= 50m
  if (!lastPoint) {
    return { isValid: true, distanceDelta: 0 };
  }

  // 2. Reject exact duplicate coordinates
  if (
    newPoint.latitude === lastPoint.latitude &&
    newPoint.longitude === lastPoint.longitude
  ) {
    return {
      isValid: false,
      distanceDelta: 0,
      reason: 'Duplicate coordinate reading',
    };
  }

  // Calculate distance moved from last accepted point
  const distanceDelta = calculateHaversineDistance(
    lastPoint.latitude,
    lastPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  // 3. Movement threshold: ignore movements smaller than 0.5 meters
  if (distanceDelta < 0.5) {
    return {
      isValid: false,
      distanceDelta: 0,
      reason: `Stationary jitter (${distanceDelta.toFixed(2)}m < 0.5m threshold)`,
    };
  }

  // 4. Speed validation check (Max 250 km/h cap)
  const timeDeltaSeconds = (newPoint.timestamp - lastPoint.timestamp) / 1000;
  if (timeDeltaSeconds > 0) {
    const calculatedSpeedMps = distanceDelta / timeDeltaSeconds;
    const calculatedSpeedKmH = calculatedSpeedMps * 3.6;

    if (calculatedSpeedKmH > maxSpeedKmH) {
      return {
        isValid: false,
        distanceDelta: 0,
        reason: `Impossible speed (${calculatedSpeedKmH.toFixed(1)} km/h > ${maxSpeedKmH} km/h limit)`,
      };
    }
  }

  // 5. Adaptive Accuracy Tiered Filtering
  // Tier A: Accuracy 0 - 10m -> Accept immediately
  if (newPoint.accuracy <= 10) {
    return { isValid: true, distanceDelta };
  }

  // Tier B: Accuracy 10 - 30m -> Accept if movement direction is consistent
  if (newPoint.accuracy > 10 && newPoint.accuracy <= 30) {
    if (previousPath.length >= 2) {
      const prevPoint = previousPath[previousPath.length - 2];
      const lastPointInPath = previousPath[previousPath.length - 1];

      const previousBearing = calculateBearing(
        prevPoint.latitude,
        prevPoint.longitude,
        lastPointInPath.latitude,
        lastPointInPath.longitude
      );

      const currentBearing = calculateBearing(
        lastPointInPath.latitude,
        lastPointInPath.longitude,
        newPoint.latitude,
        newPoint.longitude
      );

      const angleDiff = calculateAngleDifference(previousBearing, currentBearing);

      if (angleDiff > 90) {
        return {
          isValid: false,
          distanceDelta: 0,
          reason: `Directional inconsistency (${angleDiff.toFixed(0)}° turn with ${newPoint.accuracy.toFixed(1)}m accuracy)`,
        };
      }
    }
    return { isValid: true, distanceDelta };
  }

  // Tier C: Accuracy 30 - 50m -> Accept only if 3 consecutive points agree
  if (newPoint.accuracy > 30 && newPoint.accuracy <= 50) {
    if (recentRawPointsBuffer.length < 2) {
      return {
        isValid: false,
        distanceDelta: 0,
        reason: `Waiting for 3 consecutive points agreement (${newPoint.accuracy.toFixed(1)}m accuracy)`,
      };
    }

    const p1 = recentRawPointsBuffer[recentRawPointsBuffer.length - 2];
    const p2 = recentRawPointsBuffer[recentRawPointsBuffer.length - 1];

    const d1 = calculateHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    const d2 = calculateHaversineDistance(p2.latitude, p2.longitude, newPoint.latitude, newPoint.longitude);

    // Check if points are in spatial agreement (consistently moving or clustered)
    if (d1 > 100 || d2 > 100) {
      return {
        isValid: false,
        distanceDelta: 0,
        reason: `Inconsistent 3-point agreement delta (${d2.toFixed(1)}m)`,
      };
    }

    return { isValid: true, distanceDelta };
  }

  return { isValid: true, distanceDelta };
}
