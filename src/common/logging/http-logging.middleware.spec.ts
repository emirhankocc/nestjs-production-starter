import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { Response } from 'express';
import { HttpLoggingMiddleware } from './http-logging.middleware';
import { RequestWithId } from '../types/request-with-id.types';
import { HttpRequestCompletedLog } from './logging.types';

class MockResponse extends EventEmitter {
  statusCode = 200;

  constructor(statusCode = 200) {
    super();
    this.statusCode = statusCode;
  }
}

describe('HttpLoggingMiddleware', () => {
  let middleware: HttpLoggingMiddleware;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let next: jest.Mock;

  const createRequest = (): RequestWithId =>
    ({
      requestId: 'req-123',
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: {
        authorization: 'Bearer secret-access-token',
        cookie: 'session=secret-cookie',
      },
      body: {
        email: 'user@example.com',
        password: 'super-secret-password',
        refreshToken: 'secret-refresh-token',
      },
    }) as RequestWithId;

  const finishResponse = (response: MockResponse): void => {
    response.emit('finish');
  };

  const getLastLogMessage = (): HttpRequestCompletedLog => {
    const logCall = logSpy.mock.calls.at(-1) as [string] | undefined;
    const warnCall = warnSpy.mock.calls.at(-1) as [string] | undefined;
    const errorCall = errorSpy.mock.calls.at(-1) as [string] | undefined;
    const message = logCall?.[0] ?? warnCall?.[0] ?? errorCall?.[0] ?? '{}';

    return JSON.parse(message) as HttpRequestCompletedLog;
  };

  beforeEach(() => {
    middleware = new HttpLoggingMiddleware();
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs successful 200 requests with log level', () => {
    const request = createRequest();
    const response = new MockResponse(200);

    middleware.use(request, response as unknown as Response, next);
    finishResponse(response);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs 4xx responses with warn level', () => {
    const request = createRequest();
    const response = new MockResponse(401);

    middleware.use(request, response as unknown as Response, next);
    finishResponse(response);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs 5xx responses with error level', () => {
    const request = createRequest();
    const response = new MockResponse(500);

    middleware.use(request, response as unknown as Response, next);
    finishResponse(response);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('includes requestId, method, path, statusCode and durationMs', () => {
    const request = createRequest();
    const response = new MockResponse(200);

    middleware.use(request, response as unknown as Response, next);
    finishResponse(response);

    const logEntry = getLastLogMessage();

    expect(logEntry.requestId).toBe('req-123');
    expect(logEntry.method).toBe('POST');
    expect(logEntry.path).toBe('/api/v1/auth/login');
    expect(logEntry.statusCode).toBe(200);
    expect(typeof logEntry.durationMs).toBe('number');
    expect(logEntry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('does not include sensitive request data in logs', () => {
    const request = createRequest();
    const response = new MockResponse(200);

    middleware.use(request, response as unknown as Response, next);
    finishResponse(response);

    const serialized = JSON.stringify(getLastLogMessage());

    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('super-secret-password');
    expect(serialized).not.toContain('secret-access-token');
    expect(serialized).not.toContain('secret-refresh-token');
    expect(serialized).not.toContain('cookie');
    expect(serialized).not.toContain('user@example.com');
  });

  it('logs only once when the response finishes', () => {
    const request = createRequest();
    const response = new MockResponse(200);

    middleware.use(request, response as unknown as Response, next);
    finishResponse(response);
    finishResponse(response);

    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
