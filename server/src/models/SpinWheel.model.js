import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    isEliminated: {
      type: Boolean,
      default: false,
    },
    eliminatedAt: {
      type: Date,
      default: null,
    },
    eliminationRound: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const spinWheelSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['WAITING', 'ACTIVE', 'SPINNING', 'COMPLETED', 'ABORTED'],
      default: 'WAITING',
    },
    entryFee: {
      type: Number,
      required: [true, 'Entry fee is required'],
      min: [1, 'Entry fee must be at least 1 coin'],
    },
    maxParticipants: {
      type: Number,
      default: 10,
      min: [3, 'Need at least 3 participants'],
    },
    participants: [participantSchema],

    // Pool accumulators — grow as users join
    winnerPool: { type: Number, default: 0 },
    adminPool:  { type: Number, default: 0 },
    appPool:    { type: Number, default: 0 },

    // Snapshot of AppConfig at wheel creation time
    configSnapshot: {
      winnerPoolPct: { type: Number, required: true },
      adminPoolPct:  { type: Number, required: true },
      appPoolPct:    { type: Number, required: true },
    },

    // Elimination sequence — shuffled order of participant userIds
    eliminationSequence: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ],

    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    startedAt:   { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Bull job IDs — stored so we can remove jobs if wheel is aborted early
    autoStartJobId:    { type: String, default: null },
    eliminationJobId:  { type: String, default: null },
  },
  { timestamps: true }
);

// Only one wheel can be WAITING or ACTIVE or SPINNING at a time
spinWheelSchema.index(
  { status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['WAITING', 'ACTIVE', 'SPINNING'] },
    },
  }
);

const SpinWheel = mongoose.model('SpinWheel', spinWheelSchema);

export default SpinWheel;