import Joi from 'joi';

const schema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    PORT: Joi.number().default(3000),
    MONGO_URI: Joi.string().required(),
    REDIS_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().min(10).required(),
    JWT_EXPIRES_IN: Joi.string().default('7d'),
}).unknown();

const { error, value } = schema.validate(process.env);

if (error) {
    throw new Error(`Environment variable error: ${error.message}`);
}

export default value;