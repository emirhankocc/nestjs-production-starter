import { Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';
import { RequestWithId } from '../types/request-with-id.types';

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'generated-request-id'),
}));

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let request: RequestWithId;
  let setHeader: jest.Mock;
  let response: Response;
  let next: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    request = {
      headers: {},
    } as RequestWithId;
    setHeader = jest.fn();
    response = {
      setHeader,
    } as unknown as Response;
    next = jest.fn();
  });

  it('uses incoming x-request-id when valid', () => {
    request.headers['x-request-id'] = 'client-request-id';

    middleware.use(request, response, next);

    expect(request.requestId).toBe('client-request-id');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'client-request-id');
    expect(next).toHaveBeenCalled();
  });

  it('generates a UUID when x-request-id is missing', () => {
    middleware.use(request, response, next);

    expect(request.requestId).toBe('generated-request-id');
    expect(setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'generated-request-id',
    );
  });

  it('generates a UUID when x-request-id is empty', () => {
    request.headers['x-request-id'] = '   ';

    middleware.use(request, response, next);

    expect(request.requestId).toBe('generated-request-id');
  });

  it('attaches the request ID to the request object', () => {
    request.headers['x-request-id'] = 'trace-123';

    middleware.use(request, response, next);

    expect(request.requestId).toBe('trace-123');
  });

  it('sets the x-request-id response header', () => {
    request.headers['x-request-id'] = 'trace-456';

    middleware.use(request, response, next);

    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'trace-456');
  });
});
