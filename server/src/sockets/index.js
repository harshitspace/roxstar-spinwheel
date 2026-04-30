import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import logger from '../config/logger.js';
import User from '../models/User.model.js';

let io = null;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*' },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT auth middleware — runs before every connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('AUTH_MISSING: No token provided'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id name role');

      if (!user) {
        return next(new Error('AUTH_INVALID: User not found'));
      }

      // Attach user to socket for use in event handlers
      socket.user = user;
      next();
    } catch (err) {
      logger.warn(`[Socket] Auth failed: ${err.message}`);
      next(new Error('AUTH_FAILED: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket] Connected: ${socket.id} | user: ${socket.user._id}`);

    // Client calls this to subscribe to a wheel's events
    socket.on('join:wheel', (wheelId) => {
      const room = `wheel:${wheelId}`;
      socket.join(room);
      logger.info(`[Socket] ${socket.user._id} joined room ${room}`);

      // Confirm to the client they joined successfully
      socket.emit('wheel:room_joined', {
        wheelId,
        message: `Subscribed to wheel ${wheelId}`,
      });
    });

    socket.on('leave:wheel', (wheelId) => {
      const room = `wheel:${wheelId}`;
      socket.leave(room);
      logger.info(`[Socket] ${socket.user._id} left room ${room}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[Socket] Disconnected: ${socket.id} | reason: ${reason}`);
    });

    socket.on('error', (err) => {
      logger.error(`[Socket] Error on ${socket.id}: ${err.message}`);
    });
  });

  logger.info('[Socket] Socket.io server initialized');
  return io;
};

const getSocketServer = () => io;
export default getSocketServer;