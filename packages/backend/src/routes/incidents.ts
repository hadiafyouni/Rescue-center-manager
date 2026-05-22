import { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../db/pool';
import { classifyIncident } from '../classifier/rules';
import { transitionIncidentState } from '../dispatch/stateMachine';
import { runDispatchEngine } from '../dispatch/engine';
import { publishEvent } from '../realtime/pubsub';

export async function incidentRoutes(fastify: FastifyInstance) {
  fastify.post('/incidents', async (request, reply) => {
    const { description, location, victimCount = 1 } = request.body as any;

    if (!description || !location || !location.lon || !location.lat) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    const client = await pool.connect();
    let incidentId: number;
    
    try {
      await client.query('BEGIN');
      
      const res = await client.query(`
        INSERT INTO incidents (description, location, victim_count, state)
        VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, 'received')
        RETURNING id
      `, [description, location.lon, location.lat, victimCount]);
      
      incidentId = res.rows[0].id;
      
      await client.query(`
        INSERT INTO audit_log (actor, action, entity_type, entity_id, reasoning)
        VALUES ($1, $2, $3, $4, $5)
      `, ['citizen', 'create_incident', 'incident', incidentId, JSON.stringify({ description, location, victimCount })]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Broadcast to dispatchers
    publishEvent('dispatcher:incidents', { type: 'new_incident', id: incidentId });

    // Background processing (classify and dispatch)
    setImmediate(async () => {
      try {
        // 1. Classify
        const classification = classifyIncident(description, victimCount);
        
        await withTransaction(async (db) => {
          await db.query(`
            UPDATE incidents 
            SET required_services = $1, special_needs = $2, severity = $3, priority = $4
            WHERE id = $5
          `, [classification.requiredServices, classification.specialNeeds, classification.severity, classification.priority, incidentId]);
          
          await transitionIncidentState(incidentId, 'classified', 'system', { classification }, db);
        });

        // Broadcast classification
        publishEvent('dispatcher:incidents', { type: 'incident_classified', id: incidentId, classification });

        // 2. Dispatch
        // In prototype, automatically trigger dispatch engine (the engine handles rules of whether it auto-dispatches or waits for human based on severity)
        // Wait, the prompt says: "Auto-dispatch is allowed for low and medium severity. high and critical always require dispatcher confirmation on the console."
        
        if (classification.severity === 'low' || classification.severity === 'medium') {
          await runDispatchEngine(incidentId);
        }
      } catch (err) {
        fastify.log.error({ err, incidentId }, 'Error in background processing');
      }
    });

    return { id: incidentId, status: 'received' };
  });
}
