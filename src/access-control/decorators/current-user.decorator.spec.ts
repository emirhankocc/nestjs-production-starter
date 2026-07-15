import { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request.types';

function getParamDecoratorFactory(): (
  data: unknown,
  context: ExecutionContext,
) => unknown {
  class TestHost {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@CurrentUser() _value: unknown) {}
  }

  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestHost,
    'handler',
  ) as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => unknown }
  >;

  return Object.values(args)[0].factory;
}

describe('CurrentUser decorator', () => {
  it('returns the access-token payload attached to the request', () => {
    const factory = getParamDecoratorFactory();
    const payload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: Role.USER,
    };
    const request = { user: payload } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    expect(factory(undefined, context)).toEqual(payload);
  });
});
