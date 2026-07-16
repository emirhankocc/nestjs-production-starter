import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { createHelmetOptions } from '../security/helmet.config';

export function configureSecurityMiddleware(
  app: NestExpressApplication,
  configService: ConfigService,
): void {
  const trustProxy = configService.get<boolean>('TRUST_PROXY', false);

  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(helmet(createHelmetOptions()));
  app.use(compression());
}
