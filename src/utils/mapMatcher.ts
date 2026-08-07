import { GPSPoint } from '../types';

/**
 * Abstraction layer for Map Matching / Road Snapping.
 * Prepares the codebase for future OSRM or GraphHopper integration.
 */
export interface MapMatcher {
  snapToRoads(points: GPSPoint[]): Promise<GPSPoint[]>;
}

export class DefaultMapMatcher implements MapMatcher {
  /**
   * Default implementation returns original GPS coordinates without external API calls.
   */
  async snapToRoads(points: GPSPoint[]): Promise<GPSPoint[]> {
    return Promise.resolve(points);
  }
}

export const mapMatcher: MapMatcher = new DefaultMapMatcher();
