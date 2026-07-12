import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const health = {
      service: 'nestjs-production-starter',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      status: 'ok' as const,
      database: 'up' as const,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return health;
    } catch {
      throw new ServiceUnavailableException({
        ...health,
        status: 'error',
        database: 'down',
      });
    }
  }
}
