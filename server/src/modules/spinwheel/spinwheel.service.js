import mongoose from 'mongoose';
import logger from '../../config/logger.js';
import * as spinWheelRepo from './spinwheel.repository.js';
import * as coinService from '../coin/coin.service.js';
import AppConfig from '../../models/AppConfig.model.js';
import SpinWheel from '../../models/SpinWheel.model.js';
import User from '../../models/User.model.js';
import autoStartQueue from '../../queues/autostart.queue.js';
import eliminationQueue from '../../queues/elimination.queue.js';
import ApiError from '../../utils/ApiError.js';
import {
  emitParticipantJoined,
  emitWheelStarted,
} from '../../sockets/spinwheel.socket.js';

export const createWheel = async (adminId, { entryFee, maxParticipants }) => {
  const existing = await spinWheelRepo.findActiveWheel();
  if (existing) {
    throw new ApiError(409, 'An active spin wheel already exists. Only one wheel can run at a time.');
  }

  const config = await AppConfig.findOne({ key: 'default' });
  if (!config) throw new ApiError(500, 'AppConfig not found. Run the seed script.');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wheel = await spinWheelRepo.createWheel(
      {
        createdBy: adminId,
        entryFee,
        maxParticipants: maxParticipants || 10,
        status: 'WAITING',
        configSnapshot: {
          winnerPoolPct: config.winnerPoolPct,
          adminPoolPct:  config.adminPoolPct,
          appPoolPct:    config.appPoolPct,
        },
      },
      session
    );

    await session.commitTransaction();
    session.endSession();

    const job = await autoStartQueue.add(
      { wheelId: wheel._id.toString() },
      { delay: 3 * 60 * 1000, attempts: 3 }
    );

    await SpinWheel.findByIdAndUpdate(wheel._id, {
      autoStartJobId: job.id.toString(),
    });

    logger.info(`[SpinWheelService] Wheel created: ${wheel._id}`);
    return wheel;

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const joinWheel = async (userId, wheelId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wheel = await SpinWheel.findById(wheelId).session(session);

    if (!wheel) throw new ApiError(404, 'Spin wheel not found.');
    if (wheel.status !== 'WAITING') {
      throw new ApiError(400, `Cannot join a wheel in ${wheel.status} status.`);
    }
    if (wheel.participants.length >= wheel.maxParticipants) {
      throw new ApiError(400, 'This wheel is full.');
    }

    const alreadyJoined = wheel.participants.some(
      p => p.userId.toString() === userId.toString()
    );
    if (alreadyJoined) throw new ApiError(409, 'You have already joined this wheel.');

    const { winnerShare, adminShare, appShare } = await coinService.distributeEntryFee(
      userId,
      wheelId,
      wheel.entryFee,
      session
    );

    const updated = await spinWheelRepo.addParticipant(
      wheelId,
      { userId, joinedAt: new Date() },
      { winnerPool: winnerShare, adminPool: adminShare, appPool: appShare },
      session
    );

    await session.commitTransaction();
    session.endSession();

    // Fetch user details for the socket payload
    const user = await User.findById(userId).select('name');

    // Emit to everyone already in the room
    emitParticipantJoined(wheelId, {
      userId,
      name:             user?.name || 'Unknown',
      participantCount: updated.participants.length,
    });

    return updated;

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const startWheel = async (wheelId, adminId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wheel = await SpinWheel.findById(wheelId).session(session);

    if (!wheel) throw new ApiError(404, 'Spin wheel not found.');
    if (wheel.status !== 'WAITING') {
      throw new ApiError(400, `Wheel is already in ${wheel.status} status.`);
    }
    if (wheel.createdBy.toString() !== adminId.toString()) {
      throw new ApiError(403, 'Only the admin who created this wheel can start it.');
    }

    const activeParticipants = wheel.participants.filter(p => !p.isEliminated);
    if (activeParticipants.length < 3) {
      throw new ApiError(400, `Need at least 3 participants. Currently: ${activeParticipants.length}`);
    }

    const userIds = activeParticipants.map(p => p.userId);
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);

    await SpinWheel.findByIdAndUpdate(
      wheelId,
      { status: 'SPINNING', startedAt: new Date(), eliminationSequence: shuffled },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Remove auto-start job since admin started manually
    if (wheel.autoStartJobId) {
      try {
        const job = await autoStartQueue.getJob(wheel.autoStartJobId);
        if (job) await job.remove();
      } catch (e) {
        logger.warn(`[SpinWheelService] Could not remove auto-start job: ${e.message}`);
      }
    }

    // Emit wheel started to all participants in the room
    emitWheelStarted(wheelId, {
      participantCount: activeParticipants.length,
    });

    const elimJob = await eliminationQueue.add(
      { wheelId, round: 1 },
      { delay: 7000, attempts: 3, backoff: { type: 'fixed', delay: 2000 } }
    );

    await SpinWheel.findByIdAndUpdate(wheelId, {
      eliminationJobId: elimJob.id.toString(),
    });

    logger.info(`[SpinWheelService] Wheel ${wheelId} started by admin ${adminId}`);
    return wheel;

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const getWheelStatus = async (wheelId) => {
  const wheel = await SpinWheel.findById(wheelId)
    .populate('participants.userId', 'name email')
    .populate('winnerId', 'name email')
    .populate('createdBy', 'name email');

  if (!wheel) throw new ApiError(404, 'Spin wheel not found.');
  return wheel;
};