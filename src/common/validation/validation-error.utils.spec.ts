import { ValidationError } from 'class-validator';
import { buildValidationErrorDetails } from './validation-error.utils';

describe('buildValidationErrorDetails', () => {
  it('maps a simple field validation error', () => {
    const errors: ValidationError[] = [
      {
        property: 'email',
        constraints: {
          isEmail: 'email must be an email',
        },
      },
    ];

    expect(buildValidationErrorDetails(errors)).toEqual([
      {
        field: 'email',
        messages: ['email must be an email'],
      },
    ]);
  });

  it('includes multiple validation messages for one field', () => {
    const errors: ValidationError[] = [
      {
        property: 'password',
        constraints: {
          minLength: 'password must be longer than or equal to 8 characters',
          maxLength: 'password must be shorter than or equal to 128 characters',
        },
      },
    ];

    expect(buildValidationErrorDetails(errors)).toEqual([
      {
        field: 'password',
        messages: ['Invalid value', 'Invalid value'],
      },
    ]);
  });

  it('flattens nested field paths', () => {
    const errors: ValidationError[] = [
      {
        property: 'profile',
        children: [
          {
            property: 'name',
            constraints: {
              isString: 'name must be a string',
            },
          },
        ],
      },
    ];

    expect(buildValidationErrorDetails(errors)).toEqual([
      {
        field: 'profile.name',
        messages: ['name must be a string'],
      },
    ]);
  });

  it('does not expose password values in messages', () => {
    const errors: ValidationError[] = [
      {
        property: 'password',
        value: 'super-secret-password',
        constraints: {
          minLength: 'password must be longer than or equal to 8 characters',
        },
      },
    ];

    const details = buildValidationErrorDetails(errors);

    expect(details[0].messages.join(' ')).not.toContain(
      'super-secret-password',
    );
    expect(JSON.stringify(details)).not.toContain('super-secret-password');
  });

  it('rejects malformed extra fields through standard constraint messages', () => {
    const errors: ValidationError[] = [
      {
        property: 'name',
        constraints: {
          whitelistValidation: 'property name should not exist',
        },
      },
    ];

    expect(buildValidationErrorDetails(errors)).toEqual([
      {
        field: 'name',
        messages: ['property name should not exist'],
      },
    ]);
  });
});
