import Transaction from '../../models/Transaction.model.js';

export const createTransaction = async (data, session) => {
  const [transaction] = await Transaction.create([data], { session });
  return transaction;
};

export const getTransactionsByWheel = async (spinWheelId) => {
  return Transaction.find({ spinWheelId }).populate('userId', 'name email').sort({ createdAt: 1 });
};

export const getTransactionsByUser = async (userId) => {
  return Transaction.find({ userId }).populate('spinWheelId', 'status entryFee').sort({ createdAt: -1 });
};

export const getEntryTransactionsByWheel = async (spinWheelId, session) => {
  return Transaction.find(
    { spinWheelId, type: 'ENTRY_FEE' },
    null,
    { session }
  ).populate('userId', 'name email coins');
};