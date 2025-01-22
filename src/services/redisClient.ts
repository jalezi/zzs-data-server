import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redisClient = new Redis({
  host: '127.0.0.1', // Default Redis host
  port: 6379, // Default Redis port
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

export default redisClient;
