import {
  ArgumentsHost,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { GlobalExceptionFilter } from './global-exception.filter';
import { RequestWithId } from '../types/request-with-id.types';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let response: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let request: RequestWithId;

  const createHost = (): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    }) as ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter({
      get: jest.fn(),
    } as unknown as ConfigService);

    request = {
      url: '/api/v1/auth/login',
      requestId: 'req-123',
    } as RequestWithId;

    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('formats UnauthorizedException', () => {
    filter.catch(new UnauthorizedException('Unauthorized.'), createHost());

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Unauthorized.',
        path: '/api/v1/auth/login',
        requestId: 'req-123',
      }),
    );
  });

  it('formats ForbiddenException', () => {
    filter.catch(new ForbiddenException(), createHost());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        error: 'Forbidden',
        path: '/api/v1/auth/login',
        requestId: 'req-123',
      }),
    );
  });

  it('formats ConflictException', () => {
    filter.catch(
      new ConflictException('Email is already registered'),
      createHost(),
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
        message: 'Email is already registered',
      }),
    );
  });

  it('formats unknown errors as 500', () => {
    filter.catch(new Error('database host postgres:5432 failed'), createHost());

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.',
      }),
    );
  });

  const getResponseBody = (): Record<string, unknown> => {
    const call = response.json.mock.calls[0] as
      [Record<string, unknown>] | undefined;
    return call?.[0] ?? {};
  };

  it('includes path, requestId and timestamp', () => {
    filter.catch(new UnauthorizedException('Unauthorized.'), createHost());

    const body = getResponseBody();

    expect(body.path).toBe('/api/v1/auth/login');
    expect(body.requestId).toBe('req-123');
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp as string).toISOString()).toBe(
      body.timestamp,
    );
  });

  it('excludes stack traces from responses', () => {
    filter.catch(new Error('sensitive failure'), createHost());

    const body = getResponseBody();

    expect(body).not.toHaveProperty('stack');
    expect(JSON.stringify(body)).not.toContain('sensitive failure');
  });

  it('does not expose raw Prisma internals', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
      },
    );

    filter.catch(prismaError, createHost());

    const body = getResponseBody();
    const serialized = JSON.stringify(body);

    expect(body.statusCode).toBe(409);
    expect(serialized).not.toContain('P2002');
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('Unique constraint failed');
  });

  it('maps P2002 safely to 409 Conflict', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2002',
      clientVersion: '7.8.0',
    });

    filter.catch(prismaError, createHost());

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
        message: 'A record with this value already exists.',
      }),
    );
  });

  it('maps P2025 safely to 404 Not Found', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: '7.8.0',
    });

    filter.catch(prismaError, createHost());

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'The requested record was not found.',
      }),
    );
  });

  it('formats validation errors with structured details', () => {
    const validationException = new HttpException(
      {
        message: 'Validation failed',
        details: [
          {
            field: 'email',
            messages: ['email must be an email'],
          },
        ],
      },
      400,
    );

    filter.catch(validationException, createHost());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: [
          {
            field: 'email',
            messages: ['email must be an email'],
          },
        ],
      }),
    );
  });
});
