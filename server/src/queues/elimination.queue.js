import Bull from 'bull';
import config from '../config/env.js';
import logger from '../config/logger.js';

const eliminationQueue = new Bull('elimination', config.REDIS_URL);

eliminationQueue.on('completed', (job) =>
  logger.info(`[EliminationQueue] Job ${job.id} completed`)
);
eliminationQueue.on('failed', (job, err) =>
  logger.error(`[EliminationQueue] Job ${job.id} failed: ${err.message}`)
);

export default eliminationQueue;