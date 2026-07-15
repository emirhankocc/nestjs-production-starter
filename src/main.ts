import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApplication } from './common/bootstrap/configure-application';
import { logApplicationStarted } from './common/bootstrap/log-application-started';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const apiVersion = configService.get<string>('API_VERSION', '1');
  const environment = configService.get<string>('NODE_ENV', 'development');

  configureApplication(app, configService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS Production Starter')
    .setDescription('Production-oriented NestJS backend starter API.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);

  logApplicationStarted(logger, {
    port,
    apiPrefix,
    apiVersion,
    environment,
  });
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const startupError =
    error instanceof Error
      ? {
          event: 'application_startup_failed',
          exceptionName: error.name,
          message: error.message,
          ...(error.stack ? { stack: error.stack } : {}),
        }
      : {
          event: 'application_startup_failed',
          exceptionName: 'UnknownException',
          message: 'Application failed to start.',
        };

  logger.error(JSON.stringify(startupError));
  process.exit(1);
});
