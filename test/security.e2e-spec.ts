import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getOptionsToken, ThrottlerModuleOptions } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApplication } from '../src/common/bootstrap/configure-application';
import { ErrorResponseBody } from '../src/common/errors/error-response.types';
import {
  THROTTLE_AUTH,
  THROTTLE_DEFAULT,
  THROTTLE_TOO_MANY_REQUESTS_MESSAGE,
} from '../src/common/throttling/throttle.constants';
import { shouldSkipDocumentationThrottling } from '../src/common/throttling/throttle-skip-if';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';

process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/nestjs_starter?schema=public';
process.env.THROTTLE_TTL_MS ??= '60000';
process.env.THROTTLE_LIMIT ??= '100';
process.env.AUTH_THROTTLE_TTL_MS ??= '60000';
process.env.AUTH_THROTTLE_LIMIT ??= '10';
process.env.TRUST_PROXY ??= 'false';

function expectStandardErrorShape(body: ErrorResponseBody): void {
  expect(body).toEqual(
    expect.objectContaining({
      statusCode: expect.any(Number) as number,
      error: expect.any(String) as string,
      message: expect.any(String) as string,
      path: expect.any(String) as string,
      requestId: expect.any(String) as string,
      timestamp: expect.any(String) as string,
    }),
  );
  expect(body).not.toHaveProperty('stack');
  expect(JSON.stringify(body)).not.toContain('DATABASE_URL');
  expect(JSON.stringify(body)).not.toContain('JWT_ACCESS_SECRET');
  expect(JSON.stringify(body)).not.toContain('password');
  expect(JSON.stringify(body)).not.toContain('refreshToken');
}

function createThrottlerOptions(
  throttleLimit: number,
  authThrottleLimit: number,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: THROTTLE_DEFAULT,
        ttl: 60000,
        limit: throttleLimit,
      },
      {
        name: THROTTLE_AUTH,
        ttl: 60000,
        limit: authThrottleLimit,
      },
    ],
    errorMessage: THROTTLE_TOO_MANY_REQUESTS_MESSAGE,
    skipIf: shouldSkipDocumentationThrottling,
  };
}

async function createSecurityTestApp(options?: {
  throttleLimit?: number;
  authThrottleLimit?: number;
}): Promise<INestApplication<App>> {
  const throttleLimit = options?.throttleLimit ?? 100;
  const authThrottleLimit = options?.authThrottleLimit ?? 10;

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockUsersService = {
    normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
    findByEmail: jest.fn().mockResolvedValue(null),
    findByEmailWithPassword: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrismaService)
    .overrideProvider(UsersService)
    .useValue(mockUsersService)
    .overrideProvider(getOptionsToken())
    .useValue(createThrottlerOptions(throttleLimit, authThrottleLimit))
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApplication(app, app.get(ConfigService));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS Production Starter')
    .setDescription('Production-oriented NestJS backend starter API.')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.init();

  return app;
}

describe('Security (e2e)', () => {
  describe('Helmet security headers', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createSecurityTestApp();
    });

    afterEach(async () => {
      await app.close();
    });

    it('returns common security headers on API responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(JSON.stringify(response.headers)).not.toContain(
        process.env.JWT_ACCESS_SECRET,
      );
    });

    it('keeps Swagger available with security headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/docs')
        .expect(200);

      expect(response.text).toContain('Swagger UI');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Compression', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createSecurityTestApp();
    });

    afterEach(async () => {
      await app.close();
    });

    it('keeps API responses valid and unchanged', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'ok',
          service: 'nestjs-production-starter',
          database: 'up',
        }),
      );
      expect(response.status).toBe(200);
    });

    it('may compress larger Swagger responses when requested', async () => {
      const response = await request(app.getHttpServer())
        .get('/docs')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.text).toContain('Swagger UI');
      expect(response.status).toBe(200);
    });
  });

  describe('General throttling', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createSecurityTestApp({ throttleLimit: 2 });
    });

    afterEach(async () => {
      await app.close();
    });

    it('allows requests below the general limit', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });

    it('returns 429 with the standard error shape when the general limit is exceeded', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);

      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .expect(429);

      const body = response.body as ErrorResponseBody;
      expectStandardErrorShape(body);
      expect(body.statusCode).toBe(429);
      expect(body.error).toBe('Too Many Requests');
      expect(body.message).toBe('Too many requests. Please try again later.');
      expect(response.headers['x-request-id']).toBeDefined();
      expect(JSON.stringify(body)).not.toContain('ThrottlerException');
    });
  });

  describe('Authentication throttling', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createSecurityTestApp({
        throttleLimit: 20,
        authThrottleLimit: 1,
      });
    });

    afterEach(async () => {
      await app.close();
    });

    it('applies the stricter auth limit to login', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(429);

      const body = response.body as ErrorResponseBody;
      expect(body.statusCode).toBe(429);
      expect(body.error).toBe('Too Many Requests');
    });

    it('keeps logout on the general limit instead of the auth limit', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'invalid-token' })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'invalid-token' })
        .expect(204);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'invalid-token' })
        .expect(204);
    });
  });

  describe('Health and proxy configuration', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createSecurityTestApp({ throttleLimit: 1 });
    });

    afterEach(async () => {
      await app.close();
    });

    it('keeps health checks outside rate limiting', async () => {
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    });

    it('disables trust proxy by default', () => {
      const expressApp = app.getHttpAdapter().getInstance() as {
        get: (key: string) => unknown;
      };

      expect(expressApp.get('trust proxy')).toBeFalsy();
    });
  });
});
