import { GPSPoint, AccuracyQuality } from '../types';
import { calculateHaversineDistance, calculateBearing, calculateAngleDifference } from './haversine';

export interface ValidationResult {
  isValid: boolean;
  distanceDelta: number;
  reason?: string;
  smoothedPoint?: GPSPoint;
}

/**
 * Returns accuracy quality tier based on GPS error radius in meters.
 */
export function getAccuracyQuality(accuracy: number | null): AccuracyQuality {
  if (accuracy === null || accuracy > 20) return 'Poor';
  if (accuracy < 5) return 'Excellent';
  if (accuracy <= 10) return 'Good';
  return 'Fair';
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
 * Validates incoming raw GPS point with adaptive accuracy filtering, directional consistency,
 * and realistic speed bounds.
 */
export function validateGPSPointAdvanced(
  newPoint: GPSPoint,
  lastPoint: GPSPoint | null,
  previousPath: GPSPoint[] = [],
  maxSpeedKmH = 250
): ValidationResult {
  // 1. Hard cutoff for poor accuracy (> 20m)
  if (newPoint.accuracy > 20) {
    return {
      isValid: false,
      distanceDelta: 0,
      reason: `Accuracy poor (${newPoint.accuracy.toFixed(1)}m > 20m limit)`,
    };
  }

  // First point always passes initial validation if accuracy <= 20m
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

  // 3. Movement threshold: ignore movements smaller than 1.0 meter
  if (distanceDelta < 1.0) {
    return {
      isValid: false,
      distanceDelta: 0,
      reason: `Stationary jitter (${distanceDelta.toFixed(2)}m < 1.0m threshold)`,
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
  // Tier 1: Accuracy < 5m -> Accepted immediately
  if (newPoint.accuracy < 5) {
    return { isValid: true, distanceDelta };
  }

  // Tier 2: Accuracy 5m - 10m -> Requires valid distance & speed (already passed above)
  if (newPoint.accuracy <= 10) {
    return { isValid: true, distanceDelta };
  }

  // Tier 3: Accuracy 10m - 20m -> Accept only if movement direction is consistent
  if (newPoint.accuracy > 10 && newPoint.accuracy <= 20) {
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

      // If directional jump is > 90 degrees with fair accuracy, consider it noise/oscillation
      if (angleDiff > 90) {
        return {
          isValid: false,
          distanceDelta: 0,
          reason: `Directional inconsistency (${angleDiff.toFixed(0)}° turn with ${newPoint.accuracy.toFixed(1)}m accuracy)`,
        };
      }
    }
  }

  return { isValid: true, distanceDelta };
}
