import { pool } from '../db/pool';
import { findNearestUnits } from './candidates';
import { getRoute } from '../osrm/client';
import { scoreCandidates } from './scoring';
import { transitionIncidentState } from './stateMachine';
import pino from 'pino';

const logger = pino();

export async function runDispatchEngine(incidentId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const incidentRes = await client.query(
      'SELECT id, description, ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat, required_services, special_needs, severity, state FROM incidents WHERE id = $1 FOR UPDATE NOWAIT',
      [incidentId]
    );

    if (incidentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return false; // Incident not found or locked
    }
    
    const incident = incidentRes.rows[0];
    if (incident.state !== 'classified' && incident.state !== 'dispatching') {
      await client.query('ROLLBACK');
      return false; // Invalid state for dispatch
    }

    if (incident.state !== 'dispatching') {
      await transitionIncidentState(incidentId, 'dispatching', 'system', { reason: 'starting dispatch engine' }, client);
    }

    const requiredServices = incident.required_services as string[];
    const primaryService = requiredServices.includes('ambulance') ? 'ambulance' : (requiredServices.includes('firefighter') ? 'firefighter' : null);
    
    if (!primaryService) {
      await client.query('ROLLBACK');
      logger.warn(`Incident ${incidentId} requires unsupported service. Auto-dispatch failed.`);
      return false; 
    }

    // 2. Find candidates (PostGIS KNN)
    const candidates = await findNearestUnits(incident.lon, incident.lat, primaryService as any, 5);
    if (candidates.length === 0) {
      await client.query('ROLLBACK');
      logger.warn(`No candidates found for incident ${incidentId}`);
      return false;
    }

    // 3. Parallel OSRM queries
    const candidatesWithEta = await Promise.all(
      candidates.map(async (c) => {
        const route = await getRoute(c.lon, c.lat, incident.lon, incident.lat);
        return { ...c, etaSeconds: route.etaSeconds, polyline: route.polyline };
      })
    );

    // 4. Score candidates
    const classification = {
      requiredServices,
      severity: incident.severity as any,
      estimatedUnits: 1,
      specialNeeds: incident.special_needs || [],
      priority: 5,
    };
    const scored = scoreCandidates(candidatesWithEta, classification);

    // 5. Attempt assignment with SKIP LOCKED
    for (const candidate of scored) {
      const table = candidate.unit_type === 'ambulance' ? 'ambulances' : 'firefighter_units';
      
      const lockRes = await client.query(
        `SELECT id FROM ${table} WHERE id = $1 AND status = 'available' FOR UPDATE SKIP LOCKED`,
        [candidate.id]
      );
      
      if (lockRes.rows.length > 0) {
        // Secure unit
        const insertRes = await client.query(
          `INSERT INTO assignments (incident_id, unit_id, unit_type, eta_seconds, route_polyline) 
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [incidentId, candidate.id, candidate.unit_type, candidate.etaSeconds, candidate.polyline]
        );
        const assignmentId = insertRes.rows[0].id;

        await client.query(
          `UPDATE ${table} SET status = 'assigned', current_assignment_id = $1 WHERE id = $2`,
          [assignmentId, candidate.id]
        );

        const reasoning = {
          assigned_unit: candidate.id,
          eta: candidate.etaSeconds,
          score: candidate.score,
          all_candidates: scored.map(s => ({ id: s.id, score: s.score, eta: s.etaSeconds }))
        };
        await transitionIncidentState(incidentId, 'dispatched', 'system', reasoning, client);
        
        await client.query('COMMIT');
        logger.info(`Successfully dispatched unit ${candidate.id} to incident ${incidentId}`);
        return true;
      }
    }

    await client.query('ROLLBACK');
    logger.warn(`Failed to acquire any units for incident ${incidentId} due to concurrency.`);
    return false;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Error in dispatch engine');
    throw err;
  } finally {
    client.release();
  }
}
