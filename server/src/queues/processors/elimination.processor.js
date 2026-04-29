import mongoose from 'mongoose';
import logger from '../../config/logger.js';
import SpinWheel from '../../models/SpinWheel.model.js';
import * as coinService from '../../modules/coin/coin.service.js';
import getSocketServer from '../../sockets/index.js';

export const processElimination = async (job) => {
  const { wheelId, round } = job.data;
  logger.info(`[EliminationProcessor] Round ${round} for wheel ${wheelId}`);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wheel = await SpinWheel.findById(wheelId).session(session);

    if (!wheel || wheel.status !== 'SPINNING') {
      await session.abortTransaction();
      session.endSession();
      return;
    }

    const activeParticipants = wheel.participants.filter(p => !p.isEliminated);

    // Game over — only 1 left
    if (activeParticipants.length === 1) {
      const winner = activeParticipants[0];

      await coinService.payoutWinner(
        winner.userId,
        wheel.createdBy,
        wheelId,
        wheel.winnerPool,
        wheel.adminPool,
        session
      );

      await SpinWheel.findByIdAndUpdate(
        wheelId,
        {
          status: 'COMPLETED',
          winnerId: winner.userId,
          completedAt: new Date(),
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // Emit socket event
      const io = getSocketServer();
      if (io) {
        io.to(`wheel:${wheelId}`).emit('wheel:completed', {
          winnerId: winner.userId,
          winnerPool: wheel.winnerPool,
          adminPool: wheel.adminPool,
        });
      }

      logger.info(`[EliminationProcessor] Wheel ${wheelId} completed. Winner: ${winner.userId}`);
      return;
    }

    // Pick next to eliminate from persisted sequence
    const eliminatedUserId = wheel.eliminationSequence[round - 1];

    if (!eliminatedUserId) {
      throw new Error(`No elimination target found for round ${round}`);
    }

    // Mark as eliminated
    await SpinWheel.findOneAndUpdate(
      { _id: wheelId, 'participants.userId': eliminatedUserId },
      {
        $set: {
          'participants.$.isEliminated': true,
          'participants.$.eliminatedAt': new Date(),
          'participants.$.eliminationRound': round,
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Emit socket event
    const io = getSocketServer();
    if (io) {
      io.to(`wheel:${wheelId}`).emit('wheel:elimination', {
        eliminatedUserId,
        round,
        remaining: activeParticipants.length - 1,
      });
    }

    logger.info(`[EliminationProcessor] Round ${round}: eliminated ${eliminatedUserId}`);

    // Queue next elimination after 7s
    const { default: eliminationQueue } = await import('../elimination.queue.js');
    await eliminationQueue.add(
      { wheelId, round: round + 1 },
      { delay: 7000, attempts: 3, backoff: { type: 'fixed', delay: 2000 } }
    );

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`[EliminationProcessor] Error round ${round}: ${err.message}`);
    throw err;
  }
};