import rateLimit from 'express-rate-limit';

export const joinWheelLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 5,                 // max 5 join attempts per minute per IP
  message: {
    success: false,
    message: 'Too many join attempts. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createWheelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});