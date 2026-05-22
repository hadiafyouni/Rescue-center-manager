import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';
import { runDispatchEngine } from '../dispatch/engine';
import { findNearestUnits } from '../dispatch/candidates';
import { getRoute } from '../osrm/client';
import { scoreCandidates } from '../dispatch/scoring';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get('/admin/stats', async () => {
    const [incidentsRes, ambulancesRes, fireRes, hospitalsRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM incidents'),
      pool.query("SELECT COUNT(*) as total FROM ambulances WHERE status != 'out_of_service'"),
      pool.query("SELECT COUNT(*) as total FROM firefighter_units WHERE status != 'out_of_service'"),
      pool.query('SELECT COALESCE(SUM(icu_available), 0) as total_icu FROM hospitals WHERE accepting = true'),
    ]);
    return {
      totalIncidents: parseInt(incidentsRes.rows[0].total),
      activeUnits: parseInt(ambulancesRes.rows[0].total) + parseInt(fireRes.rows[0].total),
      availableIcuBeds: parseInt(hospitalsRes.rows[0].total_icu),
    };
  });

  fastify.get('/admin/units', async () => {
    const res = await pool.query(`
      SELECT id, 'ambulance' as type, status,
             ARRAY[equipment_level, crew_level] as equipment,
             ST_X(last_known_position::geometry) as lon,
             ST_Y(last_known_position::geometry) as lat
      FROM ambulances
      UNION ALL
      SELECT id, 'firefighter' as type, status,
             specialization as equipment,
             ST_X(last_known_position::geometry) as lon,
             ST_Y(last_known_position::geometry) as lat
      FROM firefighter_units
      ORDER BY type, id
    `);
    return res.rows;
  });

  fastify.get('/admin/hospitals', async () => {
    const res = await pool.query(`
      SELECT id, name, burn_unit,
             CASE WHEN trauma_capable THEN 'Level 1 Trauma' ELSE 'N/A' END as trauma_level,
             icu_available as icu_beds,
             ST_X(location::geometry) as lon,
             ST_Y(location::geometry) as lat
      FROM hospitals
      ORDER BY name ASC
    `);
    return res.rows;
  });

  fastify.get('/admin/incidents', async (request) => {
    const { state } = request.query as { state?: string };
    const res = await pool.query(`
      SELECT id, description, severity, priority, state,
             ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat,
             victim_count, required_services, created_at, classified_at, dispatched_at
      FROM incidents
      WHERE ($1::text IS NULL OR state = $1)
      ORDER BY priority DESC, created_at ASC
      LIMIT 100
    `, [state ?? null]);
    return res.rows;
  });

  fastify.get('/admin/incidents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const incidentRes = await pool.query(`
      SELECT id, description, severity, priority, state,
             ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat,
             victim_count, required_services, special_needs, created_at, classified_at, dispatched_at
      FROM incidents WHERE id = $1
    `, [id]);
    if (incidentRes.rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const assignmentsRes = await pool.query(
      'SELECT id, unit_id, unit_type, status, eta_seconds, assigned_at FROM assignments WHERE incident_id = $1',
      [id]
    );
    return { ...incidentRes.rows[0], assignments: assignmentsRes.rows };
  });

  fastify.post('/admin/incidents/:id/dispatch', async (request, reply) => {
    const { id } = request.params as { id: string };
    const incidentId = Number(id);
    const res = await pool.query('SELECT state FROM incidents WHERE id = $1', [incidentId]);
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    if (res.rows[0].state !== 'classified') {
      return reply.status(409).send({ error: `Cannot dispatch from state '${res.rows[0].state}'` });
    }
    const dispatched = await runDispatchEngine(incidentId);
    return { dispatched };
  });

  fastify.get('/admin/incidents/:id/recommendation', async (request, reply) => {
    const { id } = request.params as { id: string };
    const incidentId = Number(id);

    // For dispatched incidents, return the stored algorithm reasoning from audit log
    const auditRes = await pool.query(
      `SELECT reasoning FROM audit_log WHERE entity_type = 'incident' AND entity_id = $1 AND action = 'transition_dispatched' ORDER BY timestamp DESC LIMIT 1`,
      [incidentId]
    );
    if (auditRes.rows.length > 0) {
      return { status: 'dispatched', reasoning: auditRes.rows[0].reasoning };
    }

    // For classified incidents, run the scoring live (read-only, no commit)
    const incidentRes = await pool.query(
      `SELECT id, ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat,
              required_services, special_needs, severity, priority
       FROM incidents WHERE id = $1 AND state = 'classified'`,
      [incidentId]
    );
    if (incidentRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Incident not classified yet' });
    }

    const incident = incidentRes.rows[0];
    const requiredServices: string[] = incident.required_services || [];
    const primaryService = requiredServices.includes('ambulance') ? 'ambulance'
      : requiredServices.includes('firefighter') ? 'firefighter' : null;

    if (!primaryService) return { status: 'no_eligible_service', candidates: [] };

    const candidates = await findNearestUnits(incident.lon, incident.lat, primaryService as any, 5);
    const candidatesWithEta = await Promise.all(
      candidates.map(async (c) => {
        const route = await getRoute(c.lon, c.lat, incident.lon, incident.lat);
        return { ...c, etaSeconds: route.etaSeconds, polyline: route.polyline };
      })
    );

    const scored = scoreCandidates(candidatesWithEta, {
      requiredServices,
      severity: incident.severity,
      estimatedUnits: 1,
      specialNeeds: incident.special_needs || [],
      priority: incident.priority,
    });

    return {
      status: 'recommendation',
      candidates: scored.map(c => ({
        id: c.id,
        unit_type: c.unit_type,
        score: Math.round(c.score * 10) / 10,
        etaSeconds: c.etaSeconds,
        etaMinutes: Math.ceil(c.etaSeconds / 60),
        equipment_level: c.equipment_level,
        crew_level: c.crew_level,
      })),
    };
  });

  fastify.get('/admin/audit', async (request) => {
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };
    const res = await pool.query(`
      SELECT id, actor, action, entity_type, entity_id, before_state, after_state, reasoning, timestamp
      FROM audit_log ORDER BY timestamp DESC LIMIT $1 OFFSET $2
    `, [Number(limit), Number(offset)]);
    return res.rows;
  });
}
