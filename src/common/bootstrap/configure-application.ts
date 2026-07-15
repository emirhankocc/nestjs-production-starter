import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from '../filters/global-exception.filter';
import { createValidationExceptionFactory } from '../validation/validation-pipe.factory';

export function configureApplication(
  app: INestApplication,
  configService: ConfigService,
): void {
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const apiVersion = configService.get<string>('API_VERSION', '1');

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  });

  app.useGlobalFilters(new GlobalExceptionFilter(configService));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: createValidationExceptionFactory(),
    }),
  );
}
