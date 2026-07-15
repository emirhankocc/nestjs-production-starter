import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';
import { RequestWithId } from '../types/request-with-id.types';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim()
        : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
