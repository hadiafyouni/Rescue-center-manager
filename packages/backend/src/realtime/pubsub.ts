import { createClient } from 'redis';
import pino from 'pino';

const logger = pino();

export const redisPublisher = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

export const redisSubscriber = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

redisPublisher.on('error', (err) => logger.warn({ err }, 'Redis Publisher Error'));
redisSubscriber.on('error', (err) => logger.warn({ err }, 'Redis Subscriber Error'));

export async function connectRedis() {
  await Promise.all([
    redisPublisher.connect(),
    redisSubscriber.connect()
  ]);
  logger.info('Connected to Redis');
}

export async function publishEvent(channel: string, message: any) {
  try {
    await redisPublisher.publish(channel, JSON.stringify(message));
  } catch (err) {
    logger.warn({ err, channel }, 'Failed to publish event');
  }
}
