import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';
import path from 'path';
import { connectRedis, redisPublisher } from './realtime/pubsub';
import { setupWebSockets } from './realtime/ws';
import { incidentRoutes } from './routes/incidents';
import { pool } from './db/pool';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
  }
});

fastify.register(fastifyWebsocket);

fastify.get('/health', async () => {
  let pgStatus = 'down';
  let redisStatus = 'down';
  try {
    const res = await pool.query('SELECT 1');
    if (res.rowCount && res.rowCount > 0) pgStatus = 'up';
  } catch (e) {}

  try {
    if (redisPublisher.isReady) redisStatus = 'up';
  } catch (e) {}

  return { pg: pgStatus, redis: redisStatus };
});

async function start() {
  try {
    // Attempt Redis connection (will retry, log warnings in degraded mode if down)
    await connectRedis().catch(err => fastify.log.warn('Starting without Redis'));
    
    await fastify.register(async (app) => {
      await setupWebSockets(app);
    });
    await fastify.register(incidentRoutes);
    
    const port = Number(process.env.BACKEND_PORT) || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
