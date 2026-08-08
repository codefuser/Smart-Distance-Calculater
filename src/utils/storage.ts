import { MeasurementSession, GPSPoint, RouteMark } from '../types';

const STORAGE_KEY = 'distance_meter_sessions';

/**
 * Loads all saved measurement sessions from LocalStorage.
 */
export function getSavedSessions(): MeasurementSession[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as MeasurementSession[];
  } catch (err) {
    console.error('Failed to load saved sessions from LocalStorage', err);
    return [];
  }
}

/**
 * Saves a new measurement session to LocalStorage.
 */
export function saveSession(session: MeasurementSession): void {
  try {
    const existing = getSavedSessions();
    const updated = [session, ...existing];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save session to LocalStorage', err);
  }
}

/**
 * Deletes a session by ID from LocalStorage.
 */
export function deleteSession(id: string): MeasurementSession[] {
  try {
    const existing = getSavedSessions();
    const filtered = existing.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('Failed to delete session', err);
    return getSavedSessions();
  }
}

/**
 * Deletes all sessions from LocalStorage.
 */
export function clearAllSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear sessions', err);
  }
}

/**
 * Exports a session as a downloadable .json file.
 */
export function exportSessionJSON(session: MeasurementSession): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const safeName = session.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadAnchor.setAttribute('download', `${safeName}_${session.id}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Helper to construct a complete MeasurementSession object from live tracking data.
 */
export function buildMeasurementSession(
  path: GPSPoint[],
  totalDistanceMeters: number,
  durationSeconds: number,
  startTime: number,
  marks?: RouteMark[]
): MeasurementSession {
  const now = Date.now();
  const dateFormatted = new Date(now).toLocaleString();

  const totalPoints = path.length;
  const startLoc = path.length > 0 ? { latitude: path[0].latitude, longitude: path[0].longitude } : null;
  const endLoc = path.length > 0 ? { latitude: path[path.length - 1].latitude, longitude: path[path.length - 1].longitude } : null;

  // Calculate average accuracy
  let avgAccuracy = 0;
  if (totalPoints > 0) {
    const sumAccuracy = path.reduce((acc, p) => acc + p.accuracy, 0);
    avgAccuracy = sumAccuracy / totalPoints;
  }

  // Calculate speed metrics (km/h)
  let maxSpeedMps = 0;
  path.forEach((p) => {
    if (p.speed && p.speed > maxSpeedMps) {
      maxSpeedMps = p.speed;
    }
  });

  const avgSpeedMps = durationSeconds > 0 ? totalDistanceMeters / durationSeconds : 0;

  return {
    id: `session_${now}`,
    name: `Session ${new Date(now).toISOString().slice(0, 10)} ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    date: dateFormatted,
    startTime: startTime || now - durationSeconds * 1000,
    endTime: now,
    durationSeconds,
    totalDistanceMeters,
    totalDistanceKm: totalDistanceMeters / 1000,
    averageAccuracyMeters: avgAccuracy,
    averageSpeedKmH: avgSpeedMps * 3.6,
    maxSpeedKmH: maxSpeedMps * 3.6,
    startLocation: startLoc,
    endLocation: endLoc,
    totalGPSPoints: totalPoints,
    path,
    marks: marks && marks.length > 0 ? marks : undefined,
  };
}
