import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let healthController: HealthController;
  let prismaService: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest
              .fn()
              .mockReturnValue(
                'postgresql://postgres:postgres@localhost:5432/nestjs_starter?schema=public',
              ),
          },
        },
      ],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  it('should return status ok when database connectivity succeeds', async () => {
    const health = await healthController.getHealth();

    expect(health.status).toBe('ok');
  });

  it('should return database up when Prisma connectivity succeeds', async () => {
    const health = await healthController.getHealth();

    expect(health.database).toBe('up');
  });

  it('should return the service name', async () => {
    const health = await healthController.getHealth();

    expect(health.service).toBe('nestjs-production-starter');
  });

  it('should return a timestamp', async () => {
    const { timestamp } = await healthController.getHealth();

    expect(timestamp).toBeDefined();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it('should return numeric uptime', async () => {
    const { uptime } = await healthController.getHealth();

    expect(typeof uptime).toBe('number');
    expect(uptime).toBeGreaterThanOrEqual(0);
  });

  it('should throw ServiceUnavailableException when database connectivity fails', async () => {
    prismaService.$queryRaw.mockRejectedValueOnce(
      new Error('Database connection failed'),
    );

    await expect(healthController.getHealth()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
