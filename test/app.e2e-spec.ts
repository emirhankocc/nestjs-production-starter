import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApplication } from './../src/common/bootstrap/configure-application';
import { ErrorResponseBody } from './../src/common/errors/error-response.types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { UsersService } from './../src/users/users.service';

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
}

async function createConfiguredApp(overrides?: {
  usersService?: Partial<UsersService>;
}): Promise<INestApplication<App>> {
  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockUsersService = {
    normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
    findByEmail: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    ...overrides?.usersService,
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrismaService)
    .overrideProvider(UsersService)
    .useValue(mockUsersService)
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApplication(app, app.get(ConfigService));
  await app.init();

  return app;
}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createConfiguredApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          status: string;
          service: string;
          timestamp: string;
          uptime: number;
          database: string;
        };

        expect(body.status).toBe('ok');
        expect(body.service).toBe('nestjs-production-starter');
        expect(body.timestamp).toBeDefined();
        expect(typeof body.uptime).toBe('number');
        expect(body.database).toBe('up');
      });
  });
});

describe('Authorization (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const safeUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'USER' as const,
    isActive: true,
    createdAt: new Date('2026-07-13T00:00:00.000Z'),
  };

  const signAccessToken = (payload: {
    sub: string;
    email: string;
    role: 'USER' | 'ADMIN';
  }) =>
    jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });

  beforeEach(async () => {
    app = await createConfiguredApp({
      usersService: {
        findById: jest.fn().mockResolvedValue(safeUser),
      },
    });
    jwtService = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/v1/users/me (GET) returns the safe profile with a valid token', async () => {
    const token = signAccessToken({
      sub: safeUser.id,
      email: safeUser.email,
      role: 'USER',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      id: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
      isActive: safeUser.isActive,
      createdAt: safeUser.createdAt.toISOString(),
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('tokenHash');
  });

  it('/api/v1/users/me (GET) returns 401 without a token', () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('/api/v1/users/me (GET) returns 401 with an invalid token', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('/api/v1/admin/ping (GET) returns 200 for ADMIN token', async () => {
    const token = signAccessToken({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/ping')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      message: 'Admin access granted',
    });
  });

  it('/api/v1/admin/ping (GET) returns 403 for USER token', () => {
    const token = signAccessToken({
      sub: safeUser.id,
      email: safeUser.email,
      role: 'USER',
    });

    return request(app.getHttpServer())
      .get('/api/v1/admin/ping')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('/api/v1/admin/ping (GET) returns 401 without a token', () => {
    return request(app.getHttpServer()).get('/api/v1/admin/ping').expect(401);
  });
});

describe('Error responses (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let findByEmailMock: jest.Mock;

  const safeUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'USER' as const,
    isActive: true,
    createdAt: new Date('2026-07-13T00:00:00.000Z'),
  };

  beforeEach(async () => {
    findByEmailMock = jest.fn().mockResolvedValue(null);

    app = await createConfiguredApp({
      usersService: {
        findByEmail: findByEmailMock,
        findById: jest.fn().mockResolvedValue(safeUser),
      },
    });
    jwtService = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the standard 400 shape for invalid register body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    const body = response.body as ErrorResponseBody;
    expectStandardErrorShape(body);
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(body.message).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
    const firstDetail = body.details?.[0];
    expect(firstDetail).toBeDefined();
    expect(typeof firstDetail?.field).toBe('string');
    expect(Array.isArray(firstDetail?.messages)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('short');
  });

  it('returns the standard 401 shape for missing access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .expect(401);

    const body = response.body as ErrorResponseBody;
    expectStandardErrorShape(body);
    expect(body.statusCode).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('Unauthorized.');
  });

  it('returns the standard 403 shape for USER on admin route', async () => {
    const token = jwtService.sign(
      {
        sub: safeUser.id,
        email: safeUser.email,
        role: 'USER',
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/ping')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    const body = response.body as ErrorResponseBody;
    expectStandardErrorShape(body);
    expect(body.statusCode).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns the standard 409 shape for duplicate register', async () => {
    findByEmailMock.mockResolvedValue(safeUser);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'user@example.com', password: 'SecurePass123' })
      .expect(409);

    const body = response.body as ErrorResponseBody;
    expectStandardErrorShape(body);
    expect(body.statusCode).toBe(409);
    expect(body.error).toBe('Conflict');
    expect(body.message).toBe('Email is already registered');
  });

  it('includes x-request-id on responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(typeof response.headers['x-request-id']).toBe('string');
    expect(response.headers['x-request-id'].length).toBeGreaterThan(0);
  });

  it('echoes a client-supplied x-request-id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'client-trace-id-123')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('client-trace-id-123');
  });
});
