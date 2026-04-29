import Joi from 'joi';
import ApiError from '../../utils/ApiError.js';

const createWheelSchema = Joi.object({
  entryFee: Joi.number().integer().min(1).required(),
  maxParticipants: Joi.number().integer().min(3).max(50).optional(),
});

const validate = (schema) => (req, _res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map(d => d.message);
    throw new ApiError(400, 'Validation failed.', messages);
  }
  next();
};

export const validateCreateWheel = validate(createWheelSchema);