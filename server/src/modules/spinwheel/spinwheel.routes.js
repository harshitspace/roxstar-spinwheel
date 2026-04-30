import { Router } from 'express';
import { createWheel, joinWheel, startWheel, getWheelStatus } from './spinwheel.controller.js';
import { protect, adminOnly } from '../auth/auth.middleware.js';
import { validateCreateWheel } from './spinwheel.validator.js';
import { joinWheelLimiter, createWheelLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.post('/',          protect, adminOnly, createWheelLimiter, validateCreateWheel, createWheel);
router.post('/:id/join',  protect, joinWheelLimiter, joinWheel);
router.post('/:id/start', protect, adminOnly, startWheel);
router.get('/:id',        protect, getWheelStatus);

export default router;