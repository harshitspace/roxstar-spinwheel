import User from '../../models/User.model.js';
import ApiError from '../../utils/ApiError.js';

export const debitCoins = async (userId, amount, session) => {
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      coins: { $gte: amount }, // atomic check: only debit if enough balance
    },
    { $inc: { coins: -amount } },
    { new: true, session }
  );

  if (!user) {
    throw new ApiError(400, 'Insufficient coins or user not found.');
  }

  return user;
};

export const creditCoins = async (userId, amount, session) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { coins: amount } },
    { new: true, session }
  );

  if (!user) {
    throw new ApiError(404, 'User not found for credit operation.');
  }

  return user;
};

export const getUserWithCoins = async (userId, session) => {
  return User.findById(userId).session(session);
};