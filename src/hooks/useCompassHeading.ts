import { useState, useEffect, useCallback } from 'react';
import { getCardinalDirection } from '../utils/haversine';

export interface UseCompassHeadingReturn {
  headingAngle: number | null;
  cardinalDirection: string;
  isAvailable: boolean;
  needsPermission: boolean;
  requestCompassPermission: () => Promise<boolean>;
}

export function useCompassHeading(): UseCompassHeadingReturn {
  const [headingAngle, setHeadingAngle] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [needsPermission, setNeedsPermission] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (
      'DeviceOrientationEvent' in window &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      setNeedsPermission(true);
    }
  }, []);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    let heading: number | null = null;

    if ('webkitCompassHeading' in e && typeof (e as any).webkitCompassHeading === 'number') {
      heading = (e as any).webkitCompassHeading;
    } else if (e.alpha !== null && e.alpha !== undefined) {
      heading = (360 - e.alpha) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
      setHeadingAngle(Math.round(heading));
      setIsAvailable(true);
    }
  }, []);

  const requestCompassPermission = useCallback(async (): Promise<boolean> => {
    if (
      typeof window !== 'undefined' &&
      'DeviceOrientationEvent' in window &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
          setNeedsPermission(false);
          return true;
        }
      } catch (err) {
        console.warn('Compass permission request failed', err);
      }
      return false;
    }
    return true;
  }, [handleOrientation]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    if (!needsPermission) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [handleOrientation, needsPermission]);

  const cardinalDirection = headingAngle !== null ? getCardinalDirection(headingAngle) : 'N';

  return {
    headingAngle,
    cardinalDirection,
    isAvailable,
    needsPermission,
    requestCompassPermission,
  };
}
