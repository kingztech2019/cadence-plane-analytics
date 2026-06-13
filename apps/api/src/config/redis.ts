import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err: Error) => {
  console.error('Redis connection error', err);
});

// Plain options object for BullMQ — avoids the bundled-ioredis type conflict
function parseRedisUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 6379,
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    ...(u.pathname && u.pathname !== '/' ? { db: parseInt(u.pathname.slice(1)) || 0 } : {}),
  };
}

export const bullmqConnection = parseRedisUrl(env.REDIS_URL);
