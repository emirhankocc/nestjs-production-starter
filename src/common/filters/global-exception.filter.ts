import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import {
  ErrorResponseBody,
  ValidationErrorDetail,
} from '../errors/error-response.types';
import { UnhandledExceptionLog } from '../logging/logging.types';
import { RequestWithId } from '../types/request-with-id.types';
import { VALIDATION_FAILED_MESSAGE } from '../validation/validation-pipe.factory';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

const GENERIC_INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred.';
const PRISMA_CONFLICT_MESSAGE = 'A record with this value already exists.';
const PRISMA_NOT_FOUND_MESSAGE = 'The requested record was not found.';
const PRISMA_UNAVAILABLE_MESSAGE = 'Service is temporarily unavailable.';

const EXPECTED_CLIENT_ERROR_STATUSES = new Set([
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.CONFLICT,
]);

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const normalized = this.normalizeException(exception);

    if (this.shouldLogUnhandledException(exception, normalized.statusCode)) {
      this.logUnhandledException(exception, request);
    }

    const body: ErrorResponseBody = {
      statusCode: normalized.statusCode,
      error: normalized.error,
      message: normalized.message,
      path: request.url,
      requestId: request.requestId ?? 'unknown',
      timestamp: new Date().toISOString(),
      ...(normalized.details ? { details: normalized.details } : {}),
    };

    response.status(normalized.statusCode).json(body);
  }

  private shouldLogUnhandledException(
    exception: unknown,
    statusCode: number,
  ): boolean {
    if (EXPECTED_CLIENT_ERROR_STATUSES.has(statusCode)) {
      return false;
    }

    if (exception instanceof HttpException) {
      return statusCode >= 500;
    }

    return true;
  }

  private logUnhandledException(
    exception: unknown,
    request: RequestWithId,
  ): void {
    const logEntry: UnhandledExceptionLog = {
      event: 'unhandled_exception',
      requestId: request.requestId ?? 'unknown',
      method: request.method,
      path: request.path,
      exceptionName: this.resolveExceptionName(exception),
      ...(exception instanceof Error && exception.stack
        ? { stack: exception.stack }
        : {}),
    };

    this.logger.error(JSON.stringify(logEntry));
  }

  private resolveExceptionName(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.name;
    }

    return 'UnknownException';
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    error: string;
    message: string;
    details?: ValidationErrorDetail[];
  } {
    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    const prismaError = this.normalizePrismaException(exception);
    if (prismaError) {
      return prismaError;
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: HTTP_ERROR_NAMES[HttpStatus.INTERNAL_SERVER_ERROR],
      message: this.resolveUnknownErrorMessage(),
    };
  }

  private normalizeHttpException(exception: HttpException): {
    statusCode: number;
    error: string;
    message: string;
    details?: ValidationErrorDetail[];
  } {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const errorName = HTTP_ERROR_NAMES[statusCode] ?? 'Error';

    if (typeof response === 'string') {
      return {
        statusCode,
        error: errorName,
        message: response,
      };
    }

    if (typeof response === 'object' && response !== null) {
      const payload = response as Record<string, unknown>;
      const details = this.extractValidationDetails(payload.details);
      const message = this.extractHttpMessage(
        payload.message,
        exception.message,
      );

      if (statusCode === 400 && details !== undefined) {
        return {
          statusCode,
          error: errorName,
          message: VALIDATION_FAILED_MESSAGE,
          details,
        };
      }

      return {
        statusCode,
        error: errorName,
        message,
        ...(details ? { details } : {}),
      };
    }

    return {
      statusCode,
      error: errorName,
      message: exception.message,
    };
  }

  private normalizePrismaException(exception: unknown): {
    statusCode: number;
    error: string;
    message: string;
  } | null {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          error: HTTP_ERROR_NAMES[HttpStatus.CONFLICT],
          message: PRISMA_CONFLICT_MESSAGE,
        };
      }

      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          error: HTTP_ERROR_NAMES[HttpStatus.NOT_FOUND],
          message: PRISMA_NOT_FOUND_MESSAGE,
        };
      }
    }

    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: HTTP_ERROR_NAMES[HttpStatus.SERVICE_UNAVAILABLE],
        message: PRISMA_UNAVAILABLE_MESSAGE,
      };
    }

    if (this.isPrismaConnectivityError(exception)) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: HTTP_ERROR_NAMES[HttpStatus.SERVICE_UNAVAILABLE],
        message: PRISMA_UNAVAILABLE_MESSAGE,
      };
    }

    return null;
  }

  private isPrismaConnectivityError(exception: unknown): boolean {
    if (!(exception instanceof Error)) {
      return false;
    }

    const message = exception.message.toLowerCase();

    return (
      message.includes("can't reach database server") ||
      message.includes('connection') ||
      message.includes('database server')
    );
  }

  private resolveUnknownErrorMessage(): string {
    return GENERIC_INTERNAL_ERROR_MESSAGE;
  }

  private extractHttpMessage(message: unknown, fallback: string): string {
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message
        .filter((item): item is string => typeof item === 'string')
        .join(', ');
    }

    return fallback;
  }

  private extractValidationDetails(
    details: unknown,
  ): ValidationErrorDetail[] | undefined {
    if (!Array.isArray(details)) {
      return undefined;
    }

    const normalized = details
      .filter(
        (detail): detail is ValidationErrorDetail =>
          typeof detail === 'object' &&
          detail !== null &&
          typeof (detail as ValidationErrorDetail).field === 'string' &&
          Array.isArray((detail as ValidationErrorDetail).messages),
      )
      .map((detail) => ({
        field: detail.field,
        messages: detail.messages.filter(
          (message): message is string => typeof message === 'string',
        ),
      }));

    return normalized.length > 0 ? normalized : undefined;
  }
}
