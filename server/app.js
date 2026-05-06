import "./src/config/env.js";
import express from 'express';
import logger from "./src/config/logger.js";
import authRoutes from './src/modules/auth/auth.routes.js';
import transactionRoutes from './src/modules/transaction/transaction.routes.js';
import spinWheelRoutes from './src/modules/spinwheel/spinwheel.routes.js';
import autoStartQueue from './src/queues/autostart.queue.js';
import eliminationQueue from './src/queues/elimination.queue.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
});

app.get('/health', async (_req, res) => {
  const [autoStartCounts, eliminationCounts] = await Promise.all([
    autoStartQueue.getJobCounts(),
    eliminationQueue.getJobCounts(),
  ]);

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    queues: {
      autoStart:   autoStartCounts,
      elimination: eliminationCounts,
    },
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/spinwheel', spinWheelRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    logger.error(`${statusCode} - ${err.message}`);
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        errors: err.errors || [],
    });
});

export default app;