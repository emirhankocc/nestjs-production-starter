import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { buildValidationErrorDetails } from './validation-error.utils';

export const VALIDATION_FAILED_MESSAGE = 'Validation failed';

export function createValidationExceptionFactory(): (
  errors: ValidationError[],
) => BadRequestException {
  return (errors: ValidationError[]) =>
    new BadRequestException({
      message: VALIDATION_FAILED_MESSAGE,
      details: buildValidationErrorDetails(errors),
    });
}
