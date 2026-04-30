import ApiError from './ApiError.js';

/**
 * Valid transitions for SpinWheel status.
 * Key = current status, Value = allowed next statuses.
 */
const VALID_TRANSITIONS = {
  WAITING:   ['SPINNING', 'ABORTED'],
  SPINNING:  ['COMPLETED', 'ABORTED'],
  COMPLETED: [],   // terminal state
  ABORTED:   [],   // terminal state
};

export const assertValidTransition = (currentStatus, nextStatus) => {
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed) {
    throw new ApiError(500, `Unknown wheel status: ${currentStatus}`);
  }

  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      400,
      `Invalid state transition: ${currentStatus} → ${nextStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`
    );
  }
};