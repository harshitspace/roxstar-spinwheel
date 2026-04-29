import { Router } from 'express';
import { createWheel, joinWheel, startWheel, getWheelStatus } from './spinwheel.controller.js';
import { protect, adminOnly } from '../auth/auth.middleware.js';
import { validateCreateWheel } from './spinwheel.validator.js';

const router = Router();

router.post('/',          protect, adminOnly, validateCreateWheel, createWheel);
router.post('/:id/join',  protect, joinWheel);
router.post('/:id/start', protect, adminOnly, startWheel);
router.get('/:id',        protect, getWheelStatus);

export default router;