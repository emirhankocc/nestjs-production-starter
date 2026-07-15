import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessTokenGuard } from './access-token.guard';
import { AuthenticatedRequest } from '../types/authenticated-request.types';

describe('AccessTokenGuard', () => {
  let guard: AccessTokenGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let request: AuthenticatedRequest;

  const accessPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
  };

  const createContext = (authorization?: string): ExecutionContext => {
    request = {
      headers: { authorization },
    } as AuthenticatedRequest;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    jwtService = {
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenGuard,
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('a'.repeat(32)),
          },
        },
      ],
    }).compile();

    guard = module.get(AccessTokenGuard);
  });

  it('allows a valid Bearer access token and attaches the payload', async () => {
    jwtService.verifyAsync.mockResolvedValue(accessPayload);

    const result = await guard.canActivate(
      createContext('Bearer valid-access-token'),
    );

    expect(result).toBe(true);
    expect(request.user).toEqual(accessPayload);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-access-token', {
      secret: 'a'.repeat(32),
    });
  });

  it('rejects a missing Authorization header', async () => {
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      'Unauthorized.',
    );
  });

  it('rejects an empty Bearer token', async () => {
    await expect(guard.canActivate(createContext('Bearer '))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a Basic authentication scheme', async () => {
    await expect(
      guard.canActivate(createContext('Basic dXNlcjpwYXNz')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a malformed Authorization header', async () => {
    await expect(
      guard.canActivate(createContext('Bearer token extra')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

    await expect(
      guard.canActivate(createContext('Bearer invalid-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      guard.canActivate(createContext('Bearer expired-token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a payload without sub', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      email: 'user@example.com',
      role: Role.USER,
    });

    await expect(
      guard.canActivate(createContext('Bearer token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a payload without email', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      role: Role.USER,
    });

    await expect(
      guard.canActivate(createContext('Bearer token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a payload with an invalid role', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'SUPERADMIN',
    });

    await expect(
      guard.canActivate(createContext('Bearer token')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a refresh token payload', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sessionId: 'session-1',
    });

    await expect(
      guard.canActivate(createContext('Bearer refresh-token')),
    ).rejects.toThrow(UnauthorizedException);
  });
});
