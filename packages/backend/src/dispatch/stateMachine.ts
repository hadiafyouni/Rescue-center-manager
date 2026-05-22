import { withTransaction } from '../db/pool';
import type { PoolClient } from 'pg';

export type IncidentState = 
  | 'received'
  | 'classified'
  | 'dispatching'
  | 'dispatched'
  | 'en_route'
  | 'on_scene'
  | 'transporting'
  | 'completed'
  | 'cancelled';

const ALLOWED_TRANSITIONS: Record<IncidentState, IncidentState[]> = {
  received: ['classified', 'cancelled'],
  classified: ['dispatching', 'cancelled'],
  dispatching: ['dispatched', 'cancelled'],
  dispatched: ['en_route', 'cancelled'],
  en_route: ['on_scene', 'cancelled'],
  on_scene: ['transporting', 'completed', 'cancelled'],
  transporting: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export async function transitionIncidentState(
  incidentId: number,
  targetState: IncidentState,
  actor: string,
  reasoning: any = {},
  client?: PoolClient
) {
  const execute = async (db: PoolClient) => {
    // Lock the incident row
    const res = await db.query(
      'SELECT state FROM incidents WHERE id = $1 FOR UPDATE',
      [incidentId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const currentState = res.rows[0].state as IncidentState;

    if (!ALLOWED_TRANSITIONS[currentState].includes(targetState)) {
      throw new Error(`Invalid transition from ${currentState} to ${targetState}`);
    }

    // Update state and relevant timestamps
    let updateQuery = 'UPDATE incidents SET state = $1';
    const queryParams: any[] = [targetState];
    let paramIdx = 2;

    if (targetState === 'classified') {
      updateQuery += `, classified_at = CURRENT_TIMESTAMP`;
    } else if (targetState === 'dispatched') {
      updateQuery += `, dispatched_at = CURRENT_TIMESTAMP`;
    } else if (targetState === 'completed') {
      updateQuery += `, completed_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = $${paramIdx}`;
    queryParams.push(incidentId);

    await db.query(updateQuery, queryParams);

    // Audit log
    await db.query(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, before_state, after_state, reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        actor, 
        `transition_${targetState}`, 
        'incident', 
        incidentId, 
        JSON.stringify({ state: currentState }), 
        JSON.stringify({ state: targetState }), 
        JSON.stringify(reasoning)
      ]
    );
  };

  if (client) {
    await execute(client);
  } else {
    await withTransaction(execute);
  }
}
