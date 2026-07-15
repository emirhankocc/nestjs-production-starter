import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithId } from '../types/request-with-id.types';
import { HttpRequestCompletedLog } from './logging.types';

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpLoggingMiddleware.name);

  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    let logged = false;

    res.on('finish', () => {
      if (logged) {
        return;
      }

      logged = true;

      const durationMs =
        Math.round(
          (Number(process.hrtime.bigint() - start) / 1_000_000) * 100,
        ) / 100;
      const statusCode = res.statusCode;
      const logEntry: HttpRequestCompletedLog = {
        event: 'http_request_completed',
        requestId: req.requestId ?? 'unknown',
        method: req.method,
        path: req.path,
        statusCode,
        durationMs,
      };
      const message = JSON.stringify(logEntry);

      if (statusCode >= 500) {
        this.logger.error(message);
        return;
      }

      if (statusCode >= 400) {
        this.logger.warn(message);
        return;
      }

      this.logger.log(message);
    });

    next();
  }
}
