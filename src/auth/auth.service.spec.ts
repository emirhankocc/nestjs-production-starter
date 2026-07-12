import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
  argon2id: 2,
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: {
    normalizeEmail: jest.Mock;
    findByEmail: jest.Mock;
    findByEmailWithPassword: jest.Mock;
    findById: jest.Mock;
    createUser: jest.Mock;
  };
  let prismaService: {
    $transaction: jest.Mock;
    refreshSession: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: {
    sign: jest.Mock;
    verifyAsync: jest.Mock;
    decode: jest.Mock;
  };

  const safeUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
    isActive: true,
    createdAt: new Date('2026-07-13T00:00:00.000Z'),
  };

  const userWithPassword = {
    ...safeUser,
    passwordHash: 'hash:SecurePass123',
  };

  const configValues = {
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  beforeEach(async () => {
    usersService = {
      normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findById: jest.fn(),
      createUser: jest.fn(),
    };

    prismaService = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback({
          refreshSession: {
            create: jest.fn().mockResolvedValue({ id: 'session-1' }),
            update: jest.fn().mockResolvedValue({ id: 'session-1' }),
          },
        }),
      ),
      refreshSession: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
        update: jest.fn().mockResolvedValue({ id: 'session-1' }),
      },
    };

    jwtService = {
      sign: jest
        .fn()
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token')
        .mockReturnValue('signed-token'),
      verifyAsync: jest.fn(),
      decode: jest
        .fn()
        .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    };

    (argon2.hash as jest.Mock).mockImplementation((value: string) =>
      Promise.resolve(`hash:${value}`),
    );
    (argon2.verify as jest.Mock).mockImplementation(
      (hash: string, value: string) =>
        Promise.resolve(hash === `hash:${value}`),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(
              (key: keyof typeof configValues) => configValues[key],
            ),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('registers a user successfully', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(safeUser);
      jwtService.sign
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      const result = await authService.register({
        email: ' User@Example.com ',
        password: 'SecurePass123',
      });

      expect(result.user).toEqual(safeUser);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('normalizes email before registration', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(safeUser);
      jwtService.sign
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      await authService.register({
        email: ' User@Example.com ',
        password: 'SecurePass123',
      });

      expect(usersService.normalizeEmail).toHaveBeenCalledWith(
        ' User@Example.com ',
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith('user@example.com');
    });

    it('hashes the password before creating the user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(safeUser);
      jwtService.sign
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      await authService.register({
        email: 'user@example.com',
        password: 'SecurePass123',
      });

      expect(argon2.hash).toHaveBeenCalledWith('SecurePass123', {
        type: argon2.argon2id,
      });
      expect(usersService.createUser).toHaveBeenCalledWith(
        {
          email: 'user@example.com',
          passwordHash: 'hash:SecurePass123',
        },
        expect.any(Object),
      );
    });

    it('throws Conflict when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(safeUser);

      await expect(
        authService.register({
          email: 'user@example.com',
          password: 'SecurePass123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('does not expose passwordHash in the response', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(safeUser);
      jwtService.sign
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      const result = await authService.register({
        email: 'user@example.com',
        password: 'SecurePass123',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('tokenHash');
    });
  });

  describe('login', () => {
    it('logs in successfully', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(userWithPassword);
      jwtService.sign
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      const result = await authService.login({
        email: 'user@example.com',
        password: 'SecurePass123',
      });

      expect(result.user).toEqual(safeUser);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('throws generic Unauthorized for incorrect password', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(userWithPassword);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid email or password.'),
      );
    });

    it('throws generic Unauthorized for missing user', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'missing@example.com',
          password: 'SecurePass123',
        }),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid email or password.'),
      );
    });

    it('throws generic Unauthorized for inactive user', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        ...userWithPassword,
        isActive: false,
      });

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'SecurePass123',
        }),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid email or password.'),
      );
    });

    it('does not expose passwordHash in the response', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(userWithPassword);
      jwtService.sign
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      const result = await authService.login({
        email: 'user@example.com',
        password: 'SecurePass123',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('refresh', () => {
    const refreshSession = {
      id: 'session-1',
      userId: 'user-1',
      tokenHash: 'hash:refresh-token',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
    };

    beforeEach(() => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        sessionId: 'session-1',
      });
      prismaService.refreshSession.findUnique.mockResolvedValue(refreshSession);
      usersService.findById.mockResolvedValue(safeUser);
    });

    it('rotates a valid refresh token', async () => {
      const txRefreshSession = {
        create: jest.fn().mockResolvedValue({ id: 'session-2' }),
        update: jest.fn().mockResolvedValue({ id: 'session-1' }),
      };
      prismaService.$transaction.mockImplementation(
        (
          callback: (tx: {
            refreshSession: typeof txRefreshSession;
          }) => unknown,
        ) => callback({ refreshSession: txRefreshSession }),
      );
      jwtService.sign.mockReset();
      jwtService.sign
        .mockReturnValueOnce('new-refresh-token')
        .mockReturnValueOnce('new-access-token');

      const result = await authService.refresh({
        refreshToken: 'refresh-token',
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('revokes the old session during rotation', async () => {
      const txRefreshSession = {
        create: jest.fn().mockResolvedValue({ id: 'session-2' }),
        update: jest.fn().mockResolvedValue({ id: 'session-1' }),
      };
      prismaService.$transaction.mockImplementation(
        (
          callback: (tx: {
            refreshSession: typeof txRefreshSession;
          }) => unknown,
        ) => callback({ refreshSession: txRefreshSession }),
      );
      jwtService.sign.mockReset();
      jwtService.sign
        .mockReturnValueOnce('new-refresh-token')
        .mockReturnValueOnce('new-access-token');

      await authService.refresh({ refreshToken: 'refresh-token' });

      expect(txRefreshSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('creates a replacement session during rotation', async () => {
      const txRefreshSession = {
        create: jest.fn().mockResolvedValue({ id: 'session-2' }),
        update: jest.fn().mockResolvedValue({ id: 'session-1' }),
      };
      prismaService.$transaction.mockImplementation(
        (
          callback: (tx: {
            refreshSession: typeof txRefreshSession;
          }) => unknown,
        ) => callback({ refreshSession: txRefreshSession }),
      );
      jwtService.sign.mockReset();
      jwtService.sign
        .mockReturnValueOnce('new-refresh-token')
        .mockReturnValueOnce('new-access-token');

      await authService.refresh({ refreshToken: 'refresh-token' });

      expect(txRefreshSession.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String) as string,
          userId: 'user-1',
          tokenHash: 'hash:new-refresh-token',
          expiresAt: expect.any(Date) as Date,
        },
      });
    });

    it('throws generic Unauthorized for revoked session', async () => {
      prismaService.refreshSession.findUnique.mockResolvedValue({
        ...refreshSession,
        revokedAt: new Date(),
      });

      await expect(
        authService.refresh({ refreshToken: 'refresh-token' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid refresh token.'));
    });

    it('throws generic Unauthorized for expired session', async () => {
      prismaService.refreshSession.findUnique.mockResolvedValue({
        ...refreshSession,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(
        authService.refresh({ refreshToken: 'refresh-token' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid refresh token.'));
    });

    it('throws generic Unauthorized for missing session', async () => {
      prismaService.refreshSession.findUnique.mockResolvedValue(null);

      await expect(
        authService.refresh({ refreshToken: 'refresh-token' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid refresh token.'));
    });

    it('throws generic Unauthorized for hash mismatch', async () => {
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        authService.refresh({ refreshToken: 'refresh-token' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid refresh token.'));
    });
  });

  describe('logout', () => {
    it('revokes a valid session', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        sessionId: 'session-1',
      });
      prismaService.refreshSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        tokenHash: 'hash:refresh-token',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });

      await expect(
        authService.logout({ refreshToken: 'refresh-token' }),
      ).resolves.toBeUndefined();

      expect(prismaService.refreshSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('returns idempotently for invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(
        authService.logout({ refreshToken: 'invalid-token' }),
      ).resolves.toBeUndefined();
    });

    it('returns idempotently for already revoked session', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        sessionId: 'session-1',
      });
      prismaService.refreshSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        tokenHash: 'hash:refresh-token',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        createdAt: new Date(),
      });

      await expect(
        authService.logout({ refreshToken: 'refresh-token' }),
      ).resolves.toBeUndefined();

      expect(prismaService.refreshSession.update).not.toHaveBeenCalled();
    });
  });

  describe('token safety', () => {
    it('stores a hashed refresh token instead of the raw token', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(safeUser);
      jwtService.sign
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      const txRefreshSession = {
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
        update: jest.fn(),
      };
      prismaService.$transaction.mockImplementation(
        (
          callback: (tx: {
            refreshSession: typeof txRefreshSession;
          }) => unknown,
        ) => callback({ refreshSession: txRefreshSession }),
      );

      await authService.register({
        email: 'user@example.com',
        password: 'SecurePass123',
      });

      const createCall = txRefreshSession.create.mock.calls[0] as [
        {
          data: {
            tokenHash: string;
          };
        },
      ];

      expect(createCall[0].data.tokenHash).toBe('hash:refresh-token');
      expect(createCall[0].data.tokenHash).not.toBe('refresh-token');
    });

    it('creates access tokens with only approved payload fields', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(userWithPassword);
      jwtService.sign.mockReset();
      jwtService.sign
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      await authService.login({
        email: 'user@example.com',
        password: 'SecurePass123',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: 'user-1',
          email: 'user@example.com',
          role: Role.USER,
        },
        {
          secret: configValues.JWT_ACCESS_SECRET,
          expiresIn: configValues.JWT_ACCESS_EXPIRES_IN,
        },
      );
    });
  });
});
