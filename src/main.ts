import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApplication } from './common/bootstrap/configure-application';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 3000);

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
}

bootstrap().catch((error: unknown) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
