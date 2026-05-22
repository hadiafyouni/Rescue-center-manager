import { FastifyInstance } from 'fastify';
import { redisSubscriber } from './pubsub';
import pino from 'pino';

const logger = pino();

export async function setupWebSockets(fastify: FastifyInstance) {
  await redisSubscriber.pSubscribe('*', (message, channel) => {
    try {
      const parsed = JSON.parse(message);
      
      for (const client of fastify.websocketServer.clients) {
        if (client.readyState === 1) { // OPEN
          const authData = (client as any).authData;
          if (!authData) continue;
          
          let canReceive = false;
          
          if (authData.role === 'dispatcher' && channel.startsWith('dispatcher:')) {
            canReceive = true;
          } else if (authData.role === 'unit' && channel === `unit:${authData.id}`) {
            canReceive = true;
          } else if (authData.role === 'hospital' && channel === `hospital:${authData.id}`) {
            canReceive = true;
          } else if (channel.startsWith('incident:')) {
            canReceive = true; 
          }
          
          if (canReceive) {
            client.send(JSON.stringify({ channel, data: parsed }));
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error handling redis pubsub message');
    }
  });

  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const token = (req.query as any).token;
    
    if (!token) {
      connection.socket.close(1008, 'Token required');
      return;
    }
    
    // Mock JWT decode for prototype
    let authData: any = { role: 'guest', id: null };
    if (token === 'dispatcher_token') authData = { role: 'dispatcher', id: 1 };
    else if (token === 'unit_token') authData = { role: 'unit', id: 1 };
    else if (token === 'hospital_token') authData = { role: 'hospital', id: 1 };
    else authData = { role: 'citizen', id: token }; 

    (connection.socket as any).authData = authData;

    connection.socket.on('message', message => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === 'sync') {
          connection.socket.send(JSON.stringify({ type: 'sync_ack', status: 'ready' }));
        }
      } catch (err) {
        logger.warn('Invalid ws message');
      }
    });
  });
}
