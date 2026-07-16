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
  THROTTLE_TTL_MS: Joi.number().integer().positive().default(60000),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  AUTH_THROTTLE_TTL_MS: Joi.number().integer().positive().default(60000),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().positive().default(10),
  TRUST_PROXY: Joi.boolean().default(false),
});

type ValidatedEnvironment = {
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;
  API_VERSION: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  THROTTLE_TTL_MS: number;
  THROTTLE_LIMIT: number;
  AUTH_THROTTLE_TTL_MS: number;
  AUTH_THROTTLE_LIMIT: number;
  TRUST_PROXY: boolean;
};

const validEnvironment: ValidatedEnvironment = {
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
  THROTTLE_TTL_MS: 60000,
  THROTTLE_LIMIT: 100,
  AUTH_THROTTLE_TTL_MS: 60000,
  AUTH_THROTTLE_LIMIT: 10,
  TRUST_PROXY: false,
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

  it('accepts positive throttle configuration values', () => {
    const result = environmentValidationSchema.validate({
      ...validEnvironment,
      THROTTLE_TTL_MS: 30000,
      THROTTLE_LIMIT: 50,
      AUTH_THROTTLE_TTL_MS: 45000,
      AUTH_THROTTLE_LIMIT: 5,
    }) as Joi.ValidationResult<ValidatedEnvironment>;

    expect(result.error).toBeUndefined();

    const validated = result.value as ValidatedEnvironment;
    expect(validated.THROTTLE_LIMIT).toBe(50);
    expect(validated.AUTH_THROTTLE_LIMIT).toBe(5);
  });

  it.each([
    ['THROTTLE_TTL_MS', 0],
    ['THROTTLE_LIMIT', -1],
    ['AUTH_THROTTLE_TTL_MS', 0],
    ['AUTH_THROTTLE_LIMIT', -5],
  ])('rejects invalid throttle value for %s', (key, invalidValue) => {
    const { error } = environmentValidationSchema.validate({
      ...validEnvironment,
      [key]: invalidValue,
    });

    expect(error).toBeDefined();
  });

  it('accepts valid TRUST_PROXY boolean values', () => {
    const enabled = environmentValidationSchema.validate({
      ...validEnvironment,
      TRUST_PROXY: true,
    }) as Joi.ValidationResult<ValidatedEnvironment>;
    const disabled = environmentValidationSchema.validate({
      ...validEnvironment,
      TRUST_PROXY: 'false',
    }) as Joi.ValidationResult<ValidatedEnvironment>;

    expect(enabled.error).toBeUndefined();
    expect(disabled.error).toBeUndefined();

    const enabledValue = enabled.value as ValidatedEnvironment;
    const disabledValue = disabled.value as ValidatedEnvironment;
    expect(enabledValue.TRUST_PROXY).toBe(true);
    expect(disabledValue.TRUST_PROXY).toBe(false);
  });

  it('rejects invalid TRUST_PROXY values', () => {
    const { error } = environmentValidationSchema.validate({
      ...validEnvironment,
      TRUST_PROXY: 'yes',
    });

    expect(error).toBeDefined();
  });
});
