import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    spinWheelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SpinWheel',
      required: true,
    },
    type: {
      type: String,
      enum: ['ENTRY_FEE', 'REFUND', 'WINNER_PAYOUT', 'ADMIN_PAYOUT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, spinWheelId: 1 });
transactionSchema.index({ spinWheelId: 1, type: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;