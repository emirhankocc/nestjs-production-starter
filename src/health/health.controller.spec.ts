import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  it('should return status ok', () => {
    expect(healthController.getHealth().status).toBe('ok');
  });

  it('should return the service name', () => {
    expect(healthController.getHealth().service).toBe(
      'nestjs-production-starter',
    );
  });

  it('should return a timestamp', () => {
    const { timestamp } = healthController.getHealth();

    expect(timestamp).toBeDefined();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it('should return numeric uptime', () => {
    const { uptime } = healthController.getHealth();

    expect(typeof uptime).toBe('number');
    expect(uptime).toBeGreaterThanOrEqual(0);
  });
});
