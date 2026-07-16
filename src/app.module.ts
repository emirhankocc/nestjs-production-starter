import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { HttpLoggingMiddleware } from './common/logging/http-logging.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import {
  THROTTLE_AUTH,
  THROTTLE_DEFAULT,
  THROTTLE_TOO_MANY_REQUESTS_MESSAGE,
} from './common/throttling/throttle.constants';
import { shouldSkipDocumentationThrottling } from './common/throttling/throttle-skip-if';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

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
        DATABASE_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string()
          .pattern(/^\d+[smhd]$/)
          .required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string()
          .pattern(/^\d+[smhd]$/)
          .required(),
        THROTTLE_TTL_MS: Joi.number().integer().positive().default(60000),
        THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
        AUTH_THROTTLE_TTL_MS: Joi.number().integer().positive().default(60000),
        AUTH_THROTTLE_LIMIT: Joi.number().integer().positive().default(10),
        TRUST_PROXY: Joi.boolean().default(false),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: THROTTLE_DEFAULT,
            ttl: configService.get<number>('THROTTLE_TTL_MS', 60000),
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
          {
            name: THROTTLE_AUTH,
            ttl: configService.get<number>('AUTH_THROTTLE_TTL_MS', 60000),
            limit: configService.get<number>('AUTH_THROTTLE_LIMIT', 10),
          },
        ],
        errorMessage: THROTTLE_TOO_MANY_REQUESTS_MESSAGE,
        skipIf: shouldSkipDocumentationThrottling,
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, HttpLoggingMiddleware).forRoutes({
      path: '{*splat}',
      method: RequestMethod.ALL,
    });
  }
}
