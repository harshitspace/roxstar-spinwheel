import { Server } from 'socket.io';
import logger from '../config/logger.js';

let io = null;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    // Basic token presence check — full JWT verify happens in auth middleware
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket] Client connected: ${socket.id}`);

    socket.on('join:wheel', (wheelId) => {
      socket.join(`wheel:${wheelId}`);
      logger.info(`[Socket] ${socket.id} joined room wheel:${wheelId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getSocketServer = () => io;

export default getSocketServer;