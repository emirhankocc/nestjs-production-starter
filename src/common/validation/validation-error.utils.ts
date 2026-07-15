import { ValidationError } from 'class-validator';
import { ValidationErrorDetail } from '../errors/error-response.types';

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'secret',
  'accesstoken',
]);

function isSensitiveField(field: string): boolean {
  const normalized =
    field.split('.').pop()?.toLowerCase() ?? field.toLowerCase();
  return SENSITIVE_FIELD_NAMES.has(normalized);
}

function sanitizeMessages(field: string, messages: string[]): string[] {
  if (!isSensitiveField(field)) {
    return messages;
  }

  return messages.map(() => 'Invalid value');
}

export function buildValidationErrorDetails(
  errors: ValidationError[],
): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  const walk = (error: ValidationError, parentPath = ''): void => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      details.push({
        field,
        messages: sanitizeMessages(field, Object.values(error.constraints)),
      });
    }

    for (const child of error.children ?? []) {
      walk(child, field);
    }
  };

  for (const error of errors) {
    walk(error);
  }

  return details;
}
