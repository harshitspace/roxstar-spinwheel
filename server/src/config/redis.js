import Redis from 'ioredis';
import logger from './logger.js';

const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('connect', () => {
    logger.info('Redis connected');
});

redis.on('error', (error) => {
    logger.error(`Redis connection error: ${error.message}`);
});

export default redis;