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

export interface MotionAnalysis {
  isStationary: boolean;
  isVerifiedMovement: boolean;
  distanceDelta: number;
  displaySpeed: number | null;
}

export class StationaryDetector {
  private isStationary: boolean = false;
  private stationaryAnchor: GPSPoint | null = null;
  private lastVerifiedPoint: GPSPoint | null = null;
  private rollingWindow: GPSPoint[] = [];
  private consecutiveLowMotionCount: number = 0;
  private consecutiveHighMotionCount: number = 0;
  private isDeviceMotionActive: boolean = false;
  private motionVariance: number = 0;

  constructor() {
    this.initDeviceMotion();
  }

  private initDeviceMotion() {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      try {
        const lastAccels: number[] = [];
        window.addEventListener(
          'devicemotion',
          (e) => {
            const acc = e.acceleration || e.accelerationIncludingGravity;
            if (acc) {
              const mag = Math.sqrt(
                (acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2
              );
              lastAccels.push(mag);
              if (lastAccels.length > 20) lastAccels.shift();
              const mean = lastAccels.reduce((a, b) => a + b, 0) / lastAccels.length;
              this.motionVariance =
                lastAccels.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
                lastAccels.length;
              this.isDeviceMotionActive = true;
            }
          },
          { passive: true }
        );
      } catch {
        // DeviceMotion not permitted or unavailable
      }
    }
  }

  public reset() {
    this.isStationary = false;
    this.stationaryAnchor = null;
    this.lastVerifiedPoint = null;
    this.rollingWindow = [];
    this.consecutiveLowMotionCount = 0;
    this.consecutiveHighMotionCount = 0;
  }

  public processPoint(point: GPSPoint): MotionAnalysis {
    this.rollingWindow.push(point);
    if (this.rollingWindow.length > 8) {
      this.rollingWindow.shift();
    }

    if (!this.lastVerifiedPoint) {
      this.lastVerifiedPoint = point;
      this.stationaryAnchor = point;
      return {
        isStationary: false,
        isVerifiedMovement: true,
        distanceDelta: 0,
        displaySpeed: point.speed ?? 0,
      };
    }

    const prevPoint =
      this.rollingWindow[this.rollingWindow.length - 2] || this.lastVerifiedPoint;

    const stepDist = calculateHaversineDistance(
      prevPoint.latitude,
      prevPoint.longitude,
      point.latitude,
      point.longitude
    );

    const timeDeltaSec = Math.max((point.timestamp - prevPoint.timestamp) / 1000, 0.5);
    const stepSpeedMps = stepDist / timeDeltaSec;
    const reportedSpeedMps =
      point.speed !== undefined && point.speed !== null && point.speed >= 0
        ? point.speed
        : null;

    const effectiveSpeedMps = reportedSpeedMps !== null ? reportedSpeedMps : stepSpeedMps;

    const anchorPoint = this.stationaryAnchor || this.lastVerifiedPoint;
    const distFromAnchor = calculateHaversineDistance(
      anchorPoint.latitude,
      anchorPoint.longitude,
      point.latitude,
      point.longitude
    );

    let netDisplacement = 0;
    let grossDistance = 0;
    if (this.rollingWindow.length >= 3) {
      const firstW = this.rollingWindow[0];
      const lastW = this.rollingWindow[this.rollingWindow.length - 1];
      netDisplacement = calculateHaversineDistance(
        firstW.latitude,
        firstW.longitude,
        lastW.latitude,
        lastW.longitude
      );
      for (let i = 1; i < this.rollingWindow.length; i++) {
        grossDistance += calculateHaversineDistance(
          this.rollingWindow[i - 1].latitude,
          this.rollingWindow[i - 1].longitude,
          this.rollingWindow[i].latitude,
          this.rollingWindow[i].longitude
        );
      }
    }

    const displacementRatio = grossDistance > 0.5 ? netDisplacement / grossDistance : 0;

    // Evaluate signals
    const lowMotionSensors = this.isDeviceMotionActive && this.motionVariance < 0.1;
    const isLowMotionSample =
      lowMotionSensors ||
      effectiveSpeedMps < 0.45 ||
      stepDist < 1.0 ||
      (displacementRatio < 0.35 && stepDist < 2.0);

    const isHighMotionSample =
      effectiveSpeedMps >= 0.8 ||
      (distFromAnchor > Math.max(3.0, point.accuracy * 0.4) && stepDist >= 1.0) ||
      (stepDist >= 2.0 && displacementRatio > 0.6);

    if (this.isStationary) {
      if (isHighMotionSample) {
        this.consecutiveHighMotionCount++;
        this.consecutiveLowMotionCount = 0;
      } else {
        this.consecutiveHighMotionCount = 0;
      }

      if (this.consecutiveHighMotionCount >= 2 || distFromAnchor > 4.5) {
        this.isStationary = false;
        this.consecutiveHighMotionCount = 0;
        this.consecutiveLowMotionCount = 0;

        const verifiedDelta = calculateHaversineDistance(
          this.stationaryAnchor!.latitude,
          this.stationaryAnchor!.longitude,
          point.latitude,
          point.longitude
        );

        this.lastVerifiedPoint = point;
        this.stationaryAnchor = null;

        return {
          isStationary: false,
          isVerifiedMovement: true,
          distanceDelta: verifiedDelta,
          displaySpeed: effectiveSpeedMps,
        };
      } else {
        return {
          isStationary: true,
          isVerifiedMovement: false,
          distanceDelta: 0,
          displaySpeed: 0,
        };
      }
    } else {
      if (isLowMotionSample) {
        this.consecutiveLowMotionCount++;
        this.consecutiveHighMotionCount = 0;
      } else {
        this.consecutiveLowMotionCount = 0;
        this.consecutiveHighMotionCount++;
      }

      if (this.consecutiveLowMotionCount >= 3) {
        this.isStationary = true;
        this.stationaryAnchor = this.lastVerifiedPoint || point;
        this.consecutiveLowMotionCount = 0;
        this.consecutiveHighMotionCount = 0;

        return {
          isStationary: true,
          isVerifiedMovement: false,
          distanceDelta: 0,
          displaySpeed: 0,
        };
      } else {
        const verifiedDelta = calculateHaversineDistance(
          this.lastVerifiedPoint.latitude,
          this.lastVerifiedPoint.longitude,
          point.latitude,
          point.longitude
        );

        this.lastVerifiedPoint = point;

        return {
          isStationary: false,
          isVerifiedMovement: true,
          distanceDelta: verifiedDelta,
          displaySpeed: effectiveSpeedMps,
        };
      }
    }
  }
}

