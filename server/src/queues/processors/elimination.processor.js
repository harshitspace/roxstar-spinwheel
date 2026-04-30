import mongoose from 'mongoose';
import logger from '../../config/logger.js';
import SpinWheel from '../../models/SpinWheel.model.js';
import User from '../../models/User.model.js';
import * as coinService from '../../modules/coin/coin.service.js';
import { assertValidTransition } from '../../utils/stateMachine.js';
import {
  emitElimination,
  emitWheelCompleted,
} from '../../sockets/spinwheel.socket.js';

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
      logger.warn(`[EliminationProcessor] Wheel ${wheelId} not in SPINNING state — skipping`);
      return;
    }

    const activeParticipants = wheel.participants.filter(p => !p.isEliminated);

    // Last one standing — game over
    if (activeParticipants.length === 1) {
      const winner = activeParticipants[0];
      const winnerUser = await User.findById(winner.userId).select('name');

      assertValidTransition(wheel.status, 'COMPLETED');

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

      emitWheelCompleted(wheelId, {
        winnerId:    winner.userId,
        winnerName:  winnerUser?.name || 'Unknown',
        prize:       wheel.winnerPool,
        adminPayout: wheel.adminPool,
      });

      logger.info(`[EliminationProcessor] Wheel ${wheelId} completed. Winner: ${winner.userId}`);
      return;
    }

    // Pick next to eliminate from the persisted sequence
    const eliminatedUserId = wheel.eliminationSequence[round - 1];

    if (!eliminatedUserId) {
      throw new Error(`No elimination target at round ${round} for wheel ${wheelId}`);
    }

    const eliminatedUser = await User.findById(eliminatedUserId).select('name');

    await SpinWheel.findOneAndUpdate(
      { _id: wheelId, 'participants.userId': eliminatedUserId },
      {
        $set: {
          'participants.$.isEliminated':     true,
          'participants.$.eliminatedAt':     new Date(),
          'participants.$.eliminationRound': round,
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    emitElimination(wheelId, {
      eliminatedUserId,
      eliminatedName:  eliminatedUser?.name || 'Unknown',
      round,
      remainingCount:  activeParticipants.length - 1,
    });

    // Queue next round
    const { default: eliminationQueue } = await import('../elimination.queue.js');
    await eliminationQueue.add(
      { wheelId, round: round + 1 },
      { delay: 7000, attempts: 3, backoff: { type: 'fixed', delay: 2000 } }
    );

    logger.info(`[EliminationProcessor] Round ${round} done — eliminated ${eliminatedUserId}`);

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`[EliminationProcessor] Error round ${round}: ${err.message}`);
    throw err;
  }
};