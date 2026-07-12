import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().integer().default(3000),
        API_PREFIX: Joi.string().min(1).default('api'),
        API_VERSION: Joi.string().min(1).default('1'),
      }),
    }),
    HealthModule,
  ],
})
export class AppModule {}
