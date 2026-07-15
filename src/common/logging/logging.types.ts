export type HttpRequestCompletedLog = {
  event: 'http_request_completed';
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

export type UnhandledExceptionLog = {
  event: 'unhandled_exception';
  requestId: string;
  method: string;
  path: string;
  exceptionName: string;
  stack?: string;
};

export type ApplicationStartedLog = {
  event: 'application_started';
  port: number;
  apiPrefix: string;
  apiVersion: string;
  environment: string;
};

export type ApplicationStartupFailedLog = {
  event: 'application_startup_failed';
  exceptionName: string;
  message: string;
  stack?: string;
};
