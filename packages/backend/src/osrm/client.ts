import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const OSRM_URL = process.env.OSRM_URL || 'http://localhost:5000';

export interface RouteResult {
  etaSeconds: number;
  polyline: string;
}

export async function getRoute(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number
): Promise<RouteResult> {
  const url = `${OSRM_URL}/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OSRM returned ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no route');
    }

    return {
      etaSeconds: Math.ceil(data.routes[0].duration),
      polyline: data.routes[0].geometry,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    logger.warn({ err, fromLon, fromLat, toLon, toLat }, 'OSRM degraded mode: falling back to Haversine * 1.4');
    
    // Haversine formula
    const R = 6371e3; // metres
    const r1 = fromLat * Math.PI/180;
    const r2 = toLat * Math.PI/180;
    const dp = (toLat-fromLat) * Math.PI/180;
    const dl = (toLon-fromLon) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(r1) * Math.cos(r2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distanceMeters = R * c;
    const distanceFactor = distanceMeters * 1.4;
    // Assume 40 km/h average city speed = 11.1 m/s
    const etaSeconds = Math.ceil(distanceFactor / 11.1);
    
    return {
      etaSeconds,
      polyline: '', // Cannot provide a polyline in degraded mode
    };
  }
}
