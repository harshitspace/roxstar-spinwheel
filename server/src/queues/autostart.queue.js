import Bull from 'bull';
import config from '../config/env.js';
import logger from '../config/logger.js';

const autoStartQueue = new Bull('autostart', config.REDIS_URL);

autoStartQueue.on('completed', (job) =>
  logger.info(`[AutoStartQueue] Job ${job.id} completed`)
);
autoStartQueue.on('failed', (job, err) =>
  logger.error(`[AutoStartQueue] Job ${job.id} failed: ${err.message}`)
);

export default autoStartQueue;