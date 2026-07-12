import * as Joi from 'joi';

const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().default(3000),
  API_PREFIX: Joi.string().min(1).default('api'),
  API_VERSION: Joi.string().min(1).default('1'),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),
});

const validEnvironment = {
  NODE_ENV: 'development',
  PORT: 3000,
  API_PREFIX: 'api',
  API_VERSION: '1',
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5432/nestjs_starter?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_REFRESH_EXPIRES_IN: '7d',
};

describe('AppModule environment validation', () => {
  it('accepts valid JWT duration formats', () => {
    const durations = ['30s', '15m', '2h', '7d'];

    for (const accessDuration of durations) {
      const { error } = environmentValidationSchema.validate({
        ...validEnvironment,
        JWT_ACCESS_EXPIRES_IN: accessDuration,
      });

      expect(error).toBeUndefined();
    }
  });

  it('rejects invalid JWT_ACCESS_EXPIRES_IN values', () => {
    const { error } = environmentValidationSchema.validate({
      ...validEnvironment,
      JWT_ACCESS_EXPIRES_IN: '15minutes',
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid JWT_REFRESH_EXPIRES_IN values', () => {
    const { error } = environmentValidationSchema.validate({
      ...validEnvironment,
      JWT_REFRESH_EXPIRES_IN: '1 week',
    });

    expect(error).toBeDefined();
  });
});
