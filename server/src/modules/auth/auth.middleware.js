import jwt from 'jsonwebtoken';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiError from '../../utils/ApiError.js';
import User from '../../models/User.model.js';
import config from '../../config/env.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'You are not logged in. Please log in to get access.');
  }

  const decoded = jwt.verify(token, config.JWT_SECRET);

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'User belonging to this token no longer exists.');
  }

  req.user = user;
  next();
});

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Admin access only. You do not have permission to perform this action.');
  }
  next();
};