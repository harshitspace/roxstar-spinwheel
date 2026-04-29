import { Router } from 'express';
import { register, login, getMe } from './auth.controller.js';
import { protect } from './auth.middleware.js';
import { validateRegister, validateLogin } from './auth.validator.js';

const router = Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', protect, getMe);

export default router;