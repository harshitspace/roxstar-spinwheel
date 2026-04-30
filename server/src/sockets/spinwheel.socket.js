import getSocketServer from './index.js';
import logger from '../config/logger.js';

const wheelRoom = (wheelId) => `wheel:${wheelId}`;

/**
 * Emitted when a new participant joins the waiting room.
 * All existing participants in the room see this in real time.
 */
export const emitParticipantJoined = (wheelId, data) => {
  const io = getSocketServer();
  if (!io) return;

  const payload = {
    userId:           data.userId,
    name:             data.name,
    participantCount: data.participantCount,
    timestamp:        new Date().toISOString(),
  };

  io.to(wheelRoom(wheelId)).emit('wheel:participant_joined', payload);
  logger.info(`[SocketEvent] wheel:participant_joined | wheel=${wheelId} | user=${data.userId}`);
};

/**
 * Emitted when the wheel transitions from WAITING → SPINNING.
 * Tells all clients the game is officially starting.
 */
export const emitWheelStarted = (wheelId, data) => {
  const io = getSocketServer();
  if (!io) return;

  const payload = {
    wheelId,
    participantCount: data.participantCount,
    startedAt:        new Date().toISOString(),
    message:          'The spin wheel has started!',
  };

  io.to(wheelRoom(wheelId)).emit('wheel:started', payload);
  logger.info(`[SocketEvent] wheel:started | wheel=${wheelId}`);
};

/**
 * Emitted every 7 seconds during the SPINNING phase.
 * Tells clients who was eliminated and how many remain.
 */
export const emitElimination = (wheelId, data) => {
  const io = getSocketServer();
  if (!io) return;

  const payload = {
    eliminatedUserId: data.eliminatedUserId,
    eliminatedName:   data.eliminatedName,
    round:            data.round,
    remainingCount:   data.remainingCount,
    timestamp:        new Date().toISOString(),
  };

  io.to(wheelRoom(wheelId)).emit('wheel:elimination', payload);
  logger.info(`[SocketEvent] wheel:elimination | wheel=${wheelId} | round=${data.round} | eliminated=${data.eliminatedUserId}`);
};

/**
 * Emitted when one participant remains — the winner.
 * Includes the prize amount so clients can show a winner screen.
 */
export const emitWheelCompleted = (wheelId, data) => {
  const io = getSocketServer();
  if (!io) return;

  const payload = {
    wheelId,
    winnerId:    data.winnerId,
    winnerName:  data.winnerName,
    prize:       data.prize,
    adminPayout: data.adminPayout,
    completedAt: new Date().toISOString(),
    message:     `${data.winnerName} wins ${data.prize} coins!`,
  };

  io.to(wheelRoom(wheelId)).emit('wheel:completed', payload);
  logger.info(`[SocketEvent] wheel:completed | wheel=${wheelId} | winner=${data.winnerId} | prize=${data.prize}`);
};

/**
 * Emitted when auto-start fires but < 3 participants joined.
 * Tells clients their entry fee is being refunded.
 */
export const emitWheelAborted = (wheelId, data) => {
  const io = getSocketServer();
  if (!io) return;

  const payload = {
    wheelId,
    reason:           data.reason || 'insufficient_participants',
    participantCount: data.participantCount,
    refundAmount:     data.refundAmount,
    message:          'Wheel cancelled. Your entry fee has been refunded.',
    timestamp:        new Date().toISOString(),
  };

  io.to(wheelRoom(wheelId)).emit('wheel:aborted', payload);
  logger.info(`[SocketEvent] wheel:aborted | wheel=${wheelId} | reason=${payload.reason}`);
};