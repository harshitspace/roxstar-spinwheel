import mongoose from 'mongoose';
import logger from '../../config/logger.js';
import SpinWheel from '../../models/SpinWheel.model.js';
import * as coinService from '../../modules/coin/coin.service.js';
import eliminationQueue from '../elimination.queue.js';

export const processAutoStart = async (job) => {
  const { wheelId } = job.data;
  logger.info(`[AutoStartProcessor] Processing auto-start for wheel ${wheelId}`);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wheel = await SpinWheel.findById(wheelId).session(session);

    if (!wheel) throw new Error(`Wheel ${wheelId} not found`);

    // If already started manually, nothing to do
    if (wheel.status !== 'WAITING') {
      await session.abortTransaction();
      session.endSession();
      logger.info(`[AutoStartProcessor] Wheel ${wheelId} already in status ${wheel.status}, skipping`);
      return;
    }

    const activeParticipants = wheel.participants.filter(p => !p.isEliminated);

    // Not enough participants — abort and refund
    if (activeParticipants.length < 3) {
      logger.warn(`[AutoStartProcessor] Wheel ${wheelId} has ${activeParticipants.length} participants — aborting`);

      await coinService.refundAll(
        wheelId,
        activeParticipants,
        wheel.entryFee,
        session
      );

      await SpinWheel.findByIdAndUpdate(
        wheelId,
        { status: 'ABORTED' },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      logger.info(`[AutoStartProcessor] Wheel ${wheelId} aborted and refunds issued`);
      return;
    }

    // Enough participants — start the game
    const userIds = activeParticipants.map(p => p.userId);
    const shuffled = userIds.sort(() => Math.random() - 0.5); // Fisher-Yates lite

    await SpinWheel.findByIdAndUpdate(
      wheelId,
      {
        status: 'SPINNING',
        startedAt: new Date(),
        eliminationSequence: shuffled,
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Schedule the first elimination
    const elimJob = await eliminationQueue.add(
      { wheelId, round: 1 },
      { delay: 7000, attempts: 3, backoff: { type: 'fixed', delay: 2000 } }
    );

    // Save elimination job ID for potential cleanup
    await SpinWheel.findByIdAndUpdate(wheelId, {
      eliminationJobId: elimJob.id.toString(),
    });

    logger.info(`[AutoStartProcessor] Wheel ${wheelId} started with ${shuffled.length} participants`);

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`[AutoStartProcessor] Error: ${err.message}`);
    throw err; // re-throw so Bull marks job as failed
  }
};