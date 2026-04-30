import redis from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * Acquires a distributed Redis lock.
 * Uses SET NX EX — atomic "set if not exists with expiry".
 * Returns true if lock acquired, false if already locked.
 */
export const acquireLock = async (key, ttlSeconds = 10) => {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
};

/**
 * Releases a distributed Redis lock.
 */
export const releaseLock = async (key) => {
  await redis.del(key);
};

/**
 * Wraps an operation in a distributed lock.
 * Throws ApiError 429 if lock cannot be acquired (operation already in progress).
 */
export const withLock = async (key, ttlSeconds, operation) => {
  const acquired = await acquireLock(key, ttlSeconds);

  if (!acquired) {
    logger.warn(`[RedisLock] Could not acquire lock: ${key}`);
    const ApiError = (await import('./ApiError.js')).default;
    throw new ApiError(429, 'Operation already in progress. Please try again.');
  }

  try {
    return await operation();
  } finally {
    await releaseLock(key);
  }
};