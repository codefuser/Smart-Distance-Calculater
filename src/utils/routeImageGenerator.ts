import { MeasurementSession } from '../types';

/**
 * Generates a high-resolution PNG image of the actual recorded route using HTML5 Canvas.
 */
export function generateRouteCanvasImage(session: MeasurementSession): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const width = 1200;
      const height = 900;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // 1. Background
      ctx.fillStyle = '#020617'; // slate-950
      ctx.fillRect(0, 0, width, height);

      // Card Container Background
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(30, 30, width - 60, height - 60, 20);
      ctx.fill();
      ctx.stroke();

      // 2. Header Title & Date
      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(session.name || 'College Path Distance Measurement', 60, 85);

      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = '500 18px sans-serif';
      ctx.fillText(`Recorded: ${session.date}`, 60, 115);

      // 3. Stats Banner Box
      const bannerY = 135;
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.roundRect(60, bannerY, width - 120, 100, 14);
      ctx.fill();
      ctx.stroke();

      // Stat Columns
      const colWidth = (width - 120) / 4;

      // Col 1: Total Distance
      ctx.fillStyle = '#34d399'; // emerald-400
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('TOTAL TRAVEL DISTANCE', 80, bannerY + 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(`${session.totalDistanceMeters.toFixed(2)} m`, 80, bannerY + 68);

      // Col 2: Straight-line Distance
      ctx.fillStyle = '#38bdf8'; // sky-400
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('STRAIGHT-LINE DISTANCE', 80 + colWidth, bannerY + 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px monospace';
      const straightDist = session.straightLineDistanceMeters !== undefined
        ? `${session.straightLineDistanceMeters.toFixed(2)} m`
        : '---';
      ctx.fillText(straightDist, 80 + colWidth, bannerY + 68);

      // Col 3: Duration & Max Speed
      ctx.fillStyle = '#a78bfa'; // purple-400
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('DURATION / MAX SPEED', 80 + colWidth * 2, bannerY + 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px monospace';
      const mins = Math.floor(session.durationSeconds / 60);
      const secs = session.durationSeconds % 60;
      ctx.fillText(`${mins}m ${secs}s | ${session.maxSpeedKmH.toFixed(1)} km/h`, 80 + colWidth * 2, bannerY + 68);

      // Col 4: N/E/S/W Vectors
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('DIRECTIONAL VECTORS', 80 + colWidth * 3, bannerY + 30);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 15px monospace';
      const d = session.directionalDistances || { north: 0, east: 0, south: 0, west: 0 };
      ctx.fillText(`N: ${d.north.toFixed(1)}m | E: ${d.east.toFixed(1)}m`, 80 + colWidth * 3, bannerY + 55);
      ctx.fillText(`S: ${d.south.toFixed(1)}m | W: ${d.west.toFixed(1)}m`, 80 + colWidth * 3, bannerY + 78);

      // 4. Map Path Drawing Box
      const mapX = 60;
      const mapY = 255;
      const mapW = width - 120;
      const mapH = height - 345;

      ctx.fillStyle = '#020617';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(mapX, mapY, mapW, mapH, 16);
      ctx.fill();
      ctx.stroke();

      // North Compass Overlay in Map Box (Top Right)
      const compassX = mapX + mapW - 50;
      const compassY = mapY + 50;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(compassX, compassY, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('N', compassX, compassY - 26);
      ctx.beginPath();
      ctx.moveTo(compassX, compassY - 18);
      ctx.lineTo(compassX - 6, compassY + 4);
      ctx.lineTo(compassX + 6, compassY + 4);
      ctx.closePath();
      ctx.fill();

      // Fit GPS Coordinates to Canvas Map Box
      const pathPoints = session.path;
      if (pathPoints.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No Path Coordinates Recorded', mapX + mapW / 2, mapY + mapH / 2);
        resolve(canvas.toDataURL('image/png'));
        return;
      }

      let minLat = pathPoints[0].latitude;
      let maxLat = pathPoints[0].latitude;
      let minLon = pathPoints[0].longitude;
      let maxLon = pathPoints[0].longitude;

      pathPoints.forEach((p) => {
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLon) minLon = p.longitude;
        if (p.longitude > maxLon) maxLon = p.longitude;
      });

      // Avoid division by zero
      const latDiff = maxLat - minLat || 0.0001;
      const lonDiff = maxLon - minLon || 0.0001;

      const pad = 60;
      const drawW = mapW - pad * 2;
      const drawH = mapH - pad * 2;

      const project = (lat: number, lon: number): [number, number] => {
        const x = mapX + pad + ((lon - minLon) / lonDiff) * drawW;
        // Invert Y axis for Latitudes (North is UP)
        const y = mapY + pad + (1 - (lat - minLat) / latDiff) * drawH;
        return [x, y];
      };

      // Draw Traveled Polyline Path
      ctx.strokeStyle = '#10b981'; // emerald-500
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      pathPoints.forEach((p, idx) => {
        const [px, py] = project(p.latitude, p.longitude);
        if (idx === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();

      // Draw Numbered Mark Markers & Segment Labels
      const marks = session.marks || [];
      marks.forEach((m) => {
        const [mx, my] = project(m.latitude, m.longitude);

        // Pin Circle
        ctx.fillStyle = '#f59e0b'; // amber-500
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(mx, my, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pin Number
        ctx.fillStyle = '#020617';
        ctx.font = 'black 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m.number}`, mx, my);

        // Distance Annotation Badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        const text = `M${m.number}: ${m.distanceFromStartMeters.toFixed(1)}m`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(text).width + 12;

        ctx.beginPath();
        ctx.roundRect(mx - tw / 2, my + 20, tw, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fef3c7';
        ctx.fillText(text, mx, my + 30);
      });

      // Draw Start Marker (Green Circle + Flag)
      if (session.startLocation) {
        const [sx, sy] = project(session.startLocation.latitude, session.startLocation.longitude);
        ctx.fillStyle = '#059669'; // emerald-600
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', sx, sy);
      }

      // Draw End Marker (Red Circle + Flag)
      if (session.endLocation) {
        const [ex, ey] = project(session.endLocation.latitude, session.endLocation.longitude);
        ctx.fillStyle = '#e11d48'; // rose-600
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex, ey, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('E', ex, ey);
      }

      // Footer Watermark
      ctx.fillStyle = '#475569';
      ctx.font = '500 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Smart Distance Meter — Mobile Path Tool', width - 60, height - 38);

      resolve(canvas.toDataURL('image/png'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Triggers client-side file download of the generated route PNG image.
 */
export function downloadRouteImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
