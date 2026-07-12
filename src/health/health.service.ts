import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'nestjs-production-starter',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
