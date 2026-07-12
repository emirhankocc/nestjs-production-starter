import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

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
