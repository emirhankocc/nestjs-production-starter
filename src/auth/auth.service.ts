import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../users/types/user.types';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AccessTokenPayload,
  AuthTokensResponse,
  PreparedAuthTokens,
  PreparedRefreshSession,
  RefreshTokenPayload,
} from './types/auth.types';

@Injectable()
export class AuthService {
  private static readonly INVALID_CREDENTIALS_MESSAGE =
    'Invalid email or password.';
  private static readonly INVALID_REFRESH_TOKEN_MESSAGE =
    'Invalid refresh token.';

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensResponse> {
    const email = this.usersService.normalizeEmail(dto.email);
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const userId = randomUUID();
    const passwordHash = await this.hashPassword(dto.password);
    const preparedSafeUser: SafeUser = {
      id: userId,
      email,
      role: Role.USER,
      isActive: true,
      createdAt: new Date(),
    };
    const preparedTokens = await this.prepareAuthTokens(preparedSafeUser);

    return this.prisma.$transaction(async (tx) => {
      const user = await this.usersService.createUser(
        { id: userId, email, passwordHash },
        tx,
      );
      await this.persistRefreshSession(preparedTokens.session, tx);

      return {
        user,
        accessToken: preparedTokens.accessToken,
        refreshToken: preparedTokens.refreshToken,
      };
    });
  }

  async login(dto: LoginDto): Promise<AuthTokensResponse> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(AuthService.INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await this.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(AuthService.INVALID_CREDENTIALS_MESSAGE);
    }

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
    const preparedTokens = await this.prepareAuthTokens(safeUser);
    await this.persistRefreshSession(preparedTokens.session);

    return {
      user: safeUser,
      accessToken: preparedTokens.accessToken,
      refreshToken: preparedTokens.refreshToken,
    };
  }

  async refresh(dto: RefreshDto): Promise<AuthTokensResponse> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException(
        AuthService.INVALID_REFRESH_TOKEN_MESSAGE,
      );
    }

    const tokenMatches = await this.verifyRefreshTokenHash(
      session.tokenHash,
      dto.refreshToken,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException(
        AuthService.INVALID_REFRESH_TOKEN_MESSAGE,
      );
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        AuthService.INVALID_REFRESH_TOKEN_MESSAGE,
      );
    }

    const preparedTokens = await this.prepareAuthTokens(user);

    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException(
          AuthService.INVALID_REFRESH_TOKEN_MESSAGE,
        );
      }

      await this.persistRefreshSession(preparedTokens.session, tx);

      return {
        user,
        accessToken: preparedTokens.accessToken,
        refreshToken: preparedTokens.refreshToken,
      };
    });
  }

  async logout(dto: LogoutDto): Promise<void> {
    const payload = await this.parseRefreshToken(dto.refreshToken);

    if (!payload) {
      return;
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      return;
    }

    const tokenMatches = await this.verifyRefreshTokenHash(
      session.tokenHash,
      dto.refreshToken,
    );

    if (!tokenMatches) {
      return;
    }

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  }

  private async prepareAuthTokens(user: SafeUser): Promise<PreparedAuthTokens> {
    const sessionId = randomUUID();
    const refreshToken = this.signRefreshToken(user.id, sessionId);
    const tokenHash = await this.hashRefreshToken(refreshToken);
    const expiresAt = this.getRefreshExpiresAt();
    const accessToken = this.signAccessToken(user);

    return {
      accessToken,
      refreshToken,
      session: {
        id: sessionId,
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    };
  }

  private async persistRefreshSession(
    session: PreparedRefreshSession,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.refreshSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
      },
    });
  }

  private signAccessToken(user: SafeUser): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_ACCESS_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });
  }

  private signRefreshToken(userId: string, sessionId: string): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      sessionId,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_REFRESH_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });
  }

  private async parseRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );

      if (!payload.sub || !payload.sessionId) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    const payload = await this.parseRefreshToken(refreshToken);

    if (!payload) {
      throw new UnauthorizedException(
        AuthService.INVALID_REFRESH_TOKEN_MESSAGE,
      );
    }

    return payload;
  }

  private getRefreshExpiresAt(): Date {
    const expiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const milliseconds = this.parseDurationToMilliseconds(expiresIn);

    return new Date(Date.now() + milliseconds);
  }

  private parseDurationToMilliseconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);

    if (!match) {
      throw new InternalServerErrorException(
        'Invalid JWT_REFRESH_EXPIRES_IN value',
      );
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return value * multipliers[unit];
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  private async verifyPassword(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private async hashRefreshToken(refreshToken: string): Promise<string> {
    return argon2.hash(refreshToken, { type: argon2.argon2id });
  }

  private async verifyRefreshTokenHash(
    tokenHash: string,
    refreshToken: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(tokenHash, refreshToken);
    } catch {
      return false;
    }
  }
}
