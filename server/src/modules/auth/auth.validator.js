import Joi from 'joi';
import ApiError from '../../utils/ApiError.js';

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'admin').optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    throw new ApiError(400, 'Validation failed.', messages);
  }
  next();
};

export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);