/**
 * Calculates the distance in meters between two geographical coordinates
 * using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_METERS = 6371000; // Earth radius in meters

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates the initial bearing (compass heading angle in degrees 0-360)
 * from point 1 to point 2.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const toDegrees = (rad: number) => (rad * 180) / Math.PI;

  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);
  const rDLon = toRadians(lon2 - lon1);

  const y = Math.sin(rDLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(rDLon);

  const brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Returns the smallest angular difference (0 to 180 degrees) between two bearings.
 */
export function calculateAngleDifference(bearing1: number, bearing2: number): number {
  const diff = Math.abs(bearing1 - bearing2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Converts a compass heading angle (0-360 degrees) to an 8-point cardinal direction string.
 */
export function getCardinalDirection(bearing: number): string {
  const normalized = (bearing % 360 + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Decomposes a movement vector (distance and bearing) into North, East, South, and West distance components.
 */
export function decomposeVector(
  distanceMeters: number,
  bearingDegrees: number
): { north: number; east: number; south: number; west: number } {
  const rad = (bearingDegrees * Math.PI) / 180;
  const northComponent = distanceMeters * Math.cos(rad);
  const eastComponent = distanceMeters * Math.sin(rad);

  return {
    north: northComponent > 0 ? northComponent : 0,
    south: northComponent < 0 ? Math.abs(northComponent) : 0,
    east: eastComponent > 0 ? eastComponent : 0,
    west: eastComponent < 0 ? Math.abs(eastComponent) : 0,
  };
}
