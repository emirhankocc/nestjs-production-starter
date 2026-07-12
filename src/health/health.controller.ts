import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Application health check' })
  @ApiOkResponse({
    description: 'Current application health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'nestjs-production-starter' },
        timestamp: { type: 'string', example: '2026-07-13T00:00:00.000Z' },
        uptime: { type: 'number', example: 12.345 },
      },
    },
  })
  getHealth() {
    return this.healthService.getHealth();
  }
}
