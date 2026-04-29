import { Router } from 'express';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { protect, adminOnly } from '../auth/auth.middleware.js';
import * as transactionRepository from './transaction.repository.js';

const router = Router();

// Admin: all transactions for a wheel
router.get(
  '/wheel/:spinWheelId',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const transactions = await transactionRepository.getTransactionsByWheel(
      req.params.spinWheelId
    );
    res.status(200).json(new ApiResponse(200, transactions));
  })
);

// Any user: their own transaction history
router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const transactions = await transactionRepository.getTransactionsByUser(
      req.user._id
    );
    res.status(200).json(new ApiResponse(200, transactions));
  })
);

export default router;