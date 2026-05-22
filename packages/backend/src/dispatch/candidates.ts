import { pool } from '../db/pool';

export interface CandidateUnit {
  id: number;
  unit_type: string;
  lon: number;
  lat: number;
  equipment_level: string;
  crew_level: string;
  specialization?: string[];
  status: string;
}

export async function findNearestUnits(
  lon: number,
  lat: number,
  unitType: 'ambulance' | 'firefighter' | 'rescue',
  limit: number = 5
): Promise<CandidateUnit[]> {
  const table = unitType === 'ambulance' ? 'ambulances' : (unitType === 'firefighter' ? 'firefighter_units' : 'rescue_centers');
  
  if (unitType === 'rescue') return [];

  let query = '';
  if (unitType === 'ambulance') {
    query = `
      SELECT id, 'ambulance' as unit_type, 
             ST_X(last_known_position::geometry) as lon, 
             ST_Y(last_known_position::geometry) as lat,
             equipment_level, crew_level, null as specialization, status
      FROM ambulances
      WHERE status = 'available'
      ORDER BY last_known_position <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT $3
    `;
  } else if (unitType === 'firefighter') {
    query = `
      SELECT id, 'firefighter' as unit_type, 
             ST_X(last_known_position::geometry) as lon, 
             ST_Y(last_known_position::geometry) as lat,
             'heavy' as equipment_level, 'firefighter' as crew_level, specialization, status
      FROM firefighter_units
      WHERE status = 'available'
      ORDER BY last_known_position <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT $3
    `;
  }

  const res = await pool.query(query, [lon, lat, limit]);
  return res.rows;
}
