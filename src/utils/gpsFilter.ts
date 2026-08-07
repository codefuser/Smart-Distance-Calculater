import { GPSPoint } from '../types';
import { calculateHaversineDistance } from './haversine';

export interface GPSFilterOptions {
  maxAccuracyMeters?: number; // Maximum allowed inaccuracy (default 20m)
  minMovementMeters?: number; // Minimum movement required (default 1m)
  maxSpeedKmH?: number;       // Maximum realistic speed (default 200 km/h)
}

const DEFAULT_OPTIONS: Required<GPSFilterOptions> = {
  maxAccuracyMeters: 20,
  minMovementMeters: 1.0,
  maxSpeedKmH: 200,
};

/**
 * Validates a incoming GPS point against noise, drift, and unrealistic teleportation jumps.
 *
 * @param newPoint The fresh GPS point to evaluate
 * @param lastPoint The previous accepted valid GPS point (null if starting)
 * @param options Custom filter thresholds
 * @returns Object indicating whether point is valid and reason if rejected
 */
export function validateGPSPoint(
  newPoint: GPSPoint,
  lastPoint: GPSPoint | null,
  options: GPSFilterOptions = {}
): { isValid: boolean; distanceDelta: number; reason?: string } {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // 1. Check GPS accuracy threshold
  if (newPoint.accuracy > config.maxAccuracyMeters) {
    return {
      isValid: false,
      distanceDelta: 0,
      reason: `Accuracy too low (${newPoint.accuracy.toFixed(1)}m > ${config.maxAccuracyMeters}m limit)`,
    };
  }

  // If this is the first point, it passes initial validation
  if (!lastPoint) {
    return { isValid: true, distanceDelta: 0 };
  }

  // 2. Check for identical duplicate coordinates
  if (
    newPoint.latitude === lastPoint.latitude &&
    newPoint.longitude === lastPoint.longitude
  ) {
    return {
      isValid: false,
      distanceDelta: 0,
      reason: 'Duplicate coordinate readings',
    };
  }

  // Calculate physical distance moved since last valid point
  const distanceDelta = calculateHaversineDistance(
    lastPoint.latitude,
    lastPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  // 3. Check for minimum movement threshold (prevents stationary GPS drift noise)
  if (distanceDelta < config.minMovementMeters) {
    return {
      isValid: false,
      distanceDelta: 0,
      reason: `Movement too small (${distanceDelta.toFixed(2)}m < ${config.minMovementMeters}m limit)`,
    };
  }

  // 4. Check for impossible speed/teleportation jump (> 200 km/h)
  const timeDeltaSeconds = (newPoint.timestamp - lastPoint.timestamp) / 1000;
  if (timeDeltaSeconds > 0) {
    const calculatedSpeedMps = distanceDelta / timeDeltaSeconds;
    const calculatedSpeedKmH = calculatedSpeedMps * 3.6;

    if (calculatedSpeedKmH > config.maxSpeedKmH) {
      return {
        isValid: false,
        distanceDelta: 0,
        reason: `Impossible speed jump (${calculatedSpeedKmH.toFixed(1)} km/h > ${config.maxSpeedKmH} km/h limit)`,
      };
    }
  }

  return { isValid: true, distanceDelta };
}
