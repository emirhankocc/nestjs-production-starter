import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request.types';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let request: AuthenticatedRequest;

  const createContext = (
    user?: AuthenticatedRequest['user'],
  ): ExecutionContext => {
    request = {
      headers: {},
      user,
    } as AuthenticatedRequest;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    guard = module.get(RolesGuard);
  });

  it('allows a route without @Roles metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(createContext());

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('allows a matching ADMIN role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    const result = guard.canActivate(
      createContext({
        sub: 'admin-1',
        email: 'admin@example.com',
        role: Role.ADMIN,
      }),
    );

    expect(result).toBe(true);
  });

  it('allows a matching USER role when USER is required', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.USER]);

    const result = guard.canActivate(
      createContext({
        sub: 'user-1',
        email: 'user@example.com',
        role: Role.USER,
      }),
    );

    expect(result).toBe(true);
  });

  it('rejects a USER role on an ADMIN route', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() =>
      guard.canActivate(
        createContext({
          sub: 'user-1',
          email: 'user@example.com',
          role: Role.USER,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a request without an authenticated payload', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(createContext())).toThrow('Unauthorized.');
  });
});
