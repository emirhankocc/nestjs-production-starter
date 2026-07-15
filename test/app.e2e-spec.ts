import { INestApplication, VersioningType } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { UsersService } from './../src/users/users.service';

process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/nestjs_starter?schema=public';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
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
    mockUsersService.findById.mockResolvedValue(safeUser);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();

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
    expect(mockUsersService.findById).toHaveBeenCalledWith(safeUser.id);
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
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('tokenHash');
  });

  it('/api/v1/admin/ping (GET) returns 403 for USER token', async () => {
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
