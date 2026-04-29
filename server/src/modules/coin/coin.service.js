import mongoose from 'mongoose';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import * as coinRepository from './coin.repository.js';
import * as transactionRepository from '../transaction/transaction.repository.js';
import AppConfig from '../../models/AppConfig.model.js';
import ApiError from '../../utils/ApiError.js';

/**
 * Fetches the active pool configuration from DB.
 * Always fresh — never cached — so admin changes take effect immediately.
 */
const getPoolConfig = async () => {
  const config = await AppConfig.findOne({ key: 'default' });
  if (!config) {
    throw new ApiError(500, 'AppConfig not found. Please run the seed script.');
  }
  return config;
};

/**
 * Called when a user joins a spin wheel.
 * Debits entry fee from user, credits winner/admin/app pools on the wheel document.
 * Returns the calculated split amounts.
 */
export const distributeEntryFee = async (userId, spinWheelId, entryFee, session) => {
  const config = await getPoolConfig();

  const winnerShare = Math.floor((config.winnerPoolPct / 100) * entryFee);
  const adminShare  = Math.floor((config.adminPoolPct  / 100) * entryFee);
  const appShare    = entryFee - winnerShare - adminShare; // remainder goes to app to avoid rounding loss

  // Step 1: get balance before debit (for transaction record)
  const userBefore = await coinRepository.getUserWithCoins(userId, session);
  if (!userBefore) throw new ApiError(404, 'User not found.');
  if (userBefore.coins < entryFee) {
    throw new ApiError(400, 'Insufficient coins to join this wheel.');
  }

  // Step 2: Atomic debit from user
  const userAfter = await coinRepository.debitCoins(userId, entryFee, session);

  // Step 3: Record ENTRY_FEE transaction
  await transactionRepository.createTransaction(
    {
      userId,
      spinWheelId,
      type: 'ENTRY_FEE',
      amount: -entryFee,
      balanceBefore: userBefore.coins,
      balanceAfter: userAfter.coins,
      meta: { winnerShare, adminShare, appShare, config: config.key },
    },
    session
  );

  logger.info(`[CoinService] Entry fee distributed: user=${userId} wheel=${spinWheelId} fee=${entryFee}`);

  return { winnerShare, adminShare, appShare };
};

/**
 * Called when a spin wheel completes.
 * Credits winner with accumulated winner pool.
 * Credits admin with accumulated admin pool.
 */
export const payoutWinner = async (winnerId, adminId, spinWheelId, winnerPool, adminPool, session) => {
  // Credit winner
  const winnerBefore = await coinRepository.getUserWithCoins(winnerId, session);
  const winnerAfter  = await coinRepository.creditCoins(winnerId, winnerPool, session);

  await transactionRepository.createTransaction(
    {
      userId: winnerId,
      spinWheelId,
      type: 'WINNER_PAYOUT',
      amount: winnerPool,
      balanceBefore: winnerBefore.coins,
      balanceAfter: winnerAfter.coins,
      meta: { role: 'winner' },
    },
    session
  );

  // Credit admin
  const adminBefore = await coinRepository.getUserWithCoins(adminId, session);
  const adminAfter  = await coinRepository.creditCoins(adminId, adminPool, session);

  await transactionRepository.createTransaction(
    {
      userId: adminId,
      spinWheelId,
      type: 'ADMIN_PAYOUT',
      amount: adminPool,
      balanceBefore: adminBefore.coins,
      balanceAfter: adminAfter.coins,
      meta: { role: 'admin' },
    },
    session
  );

  logger.info(`[CoinService] Payout complete: winner=${winnerId}(+${winnerPool}) admin=${adminId}(+${adminPool})`);

  return { winnerPool, adminPool };
};

/**
 * Called when a wheel is aborted (< 3 participants after 3 minutes).
 * Refunds entry fee to every participant.
 */
export const refundAll = async (spinWheelId, participants, entryFee, session) => {
  const refunds = [];

  for (const participant of participants) {
    const userId = participant.userId;

    const userBefore = await coinRepository.getUserWithCoins(userId, session);
    const userAfter  = await coinRepository.creditCoins(userId, entryFee, session);

    await transactionRepository.createTransaction(
      {
        userId,
        spinWheelId,
        type: 'REFUND',
        amount: entryFee,
        balanceBefore: userBefore.coins,
        balanceAfter: userAfter.coins,
        meta: { reason: 'wheel_aborted' },
      },
      session
    );

    refunds.push({ userId, refunded: entryFee });
  }

  logger.info(`[CoinService] Refunded ${refunds.length} participants for wheel=${spinWheelId}`);

  return refunds;
};

/**
 * Wraps any coin operation in a MongoDB session + transaction.
 * Use this in controllers/services that need to call coin ops atomically.
 *
 * Usage:
 *   const result = await withCoinTransaction(async (session) => {
 *     return distributeEntryFee(userId, wheelId, fee, session);
 *   });
 */
export const withCoinTransaction = async (operation) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await operation(session);
    await session.commitTransaction();
    logger.info('[CoinService] Transaction committed.');
    return result;
  } catch (err) {
    await session.abortTransaction();
    logger.error(`[CoinService] Transaction aborted: ${err.message}`);
    throw err;
  } finally {
    session.endSession();
  }
};