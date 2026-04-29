import SpinWheel from '../../models/SpinWheel.model.js';

export const createWheel = async (data, session) => {
  const [wheel] = await SpinWheel.create([data], { session });
  return wheel;
};

export const findWheelById = async (id, session = null) => {
  const query = SpinWheel.findById(id).populate('participants.userId', 'name email');
  if (session) query.session(session);
  return query;
};

export const findActiveWheel = async () => {
  return SpinWheel.findOne({
    status: { $in: ['WAITING', 'ACTIVE', 'SPINNING'] },
  });
};

export const updateWheelStatus = async (id, status, extra = {}, session = null) => {
  const query = SpinWheel.findByIdAndUpdate(
    id,
    { status, ...extra },
    { new: true, session }
  );
  return query;
};

export const addParticipant = async (wheelId, participantData, poolUpdates, session) => {
  return SpinWheel.findByIdAndUpdate(
    wheelId,
    {
      $push: { participants: participantData },
      $inc: poolUpdates,
    },
    { new: true, session }
  );
};

export const eliminateParticipant = async (wheelId, userId, round, session) => {
  return SpinWheel.findOneAndUpdate(
    { _id: wheelId, 'participants.userId': userId },
    {
      $set: {
        'participants.$.isEliminated': true,
        'participants.$.eliminatedAt': new Date(),
        'participants.$.eliminationRound': round,
      },
    },
    { new: true, session }
  );
};