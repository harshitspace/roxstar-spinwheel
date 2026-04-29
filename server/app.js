import "./src/config/env.js";
import express from 'express';
import logger from "./src/config/logger.js";
import authRoutes from './src/modules/auth/auth.routes.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// API routes
app.use('/api/v1/auth', authRoutes);

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