import jwt from 'jsonwebtoken';
import User from '../../models/User.model.js';
import ApiError from '../../utils/ApiError.js';
import config from '../../config/env.js';

const signToken = (id) =>
  jwt.sign({ id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });

export const registerUser = async ({ name, email, password, role }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, 'Email already registered.');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role === 'admin' ? 'admin' : 'user',
    coins: 1000, // default starting coins
  });

  const token = signToken(user._id);

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      coins: user.coins,
    },
  };
};

export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw new ApiError(400, 'Please provide valid credentials.');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid credentials.');
  }

  const token = signToken(user._id);

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      coins: user.coins,
    },
  };
};

export const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found.');
  return user;
};