import { pool } from '../db/pool';
import { getRoute } from '../osrm/client';
import pino from 'pino';

const logger = pino();

export interface CandidateHospital {
  id: number;
  name: string;
  lon: number;
  lat: number;
  icu_available: number;
}

export async function findBestHospital(
  incidentLon: number,
  incidentLat: number,
  specializationRequired: 'trauma' | 'burn' | null
): Promise<CandidateHospital | null> {
  const client = await pool.connect();
  try {
    let specFilter = '';
    if (specializationRequired === 'trauma') {
      specFilter = 'AND trauma_capable = true';
    } else if (specializationRequired === 'burn') {
      specFilter = 'AND burn_unit = true';
    }

    // KNN query to get nearest 3 eligible hospitals
    const res = await client.query(`
      SELECT id, name, 
             ST_X(location::geometry) as lon, 
             ST_Y(location::geometry) as lat,
             icu_available
      FROM hospitals
      WHERE accepting = true AND operational_status = 'operational'
        ${specFilter}
      ORDER BY location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 3
    `, [incidentLon, incidentLat]);

    if (res.rows.length === 0) {
      return null; // No hospital available
    }

    const candidates = res.rows as CandidateHospital[];

    // Parallel OSRM ETAs
    const candidatesWithEta = await Promise.all(
      candidates.map(async (c) => {
        const route = await getRoute(incidentLon, incidentLat, c.lon, c.lat);
        return { ...c, etaSeconds: route.etaSeconds };
      })
    );

    // Sort by ETA
    candidatesWithEta.sort((a, b) => a.etaSeconds - b.etaSeconds);

    return candidatesWithEta[0];
  } finally {
    client.release();
  }
}
