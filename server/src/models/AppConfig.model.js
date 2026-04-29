import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    winnerPoolPct: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    adminPoolPct: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    appPoolPct: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

// Validate percentages sum to 100
appConfigSchema.pre('save', function () {
  const total = this.winnerPoolPct + this.adminPoolPct + this.appPoolPct;
  if (Math.round(total) !== 100) {
    throw new Error(`Pool percentages must sum to 100. Got ${total}`);
  }
});

const AppConfig = mongoose.model('AppConfig', appConfigSchema);

export default AppConfig;