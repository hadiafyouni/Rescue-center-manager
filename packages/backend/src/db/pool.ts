import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// For local dev, go up 4 levels to the root .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'dispatch',
  password: process.env.POSTGRES_PASSWORD || 'dispatch_dev',
  database: process.env.POSTGRES_DB || 'dispatch',
});

/**
 * Wraps a callback in a Postgres transaction with proper rollback on error.
 */
export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
