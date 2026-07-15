import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AccessTokenPayload } from '../../auth/types/auth.types';
import { AuthenticatedRequest } from '../types/authenticated-request.types';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private static readonly UNAUTHORIZED_MESSAGE = 'Unauthorized.';

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException(AccessTokenGuard.UNAUTHORIZED_MESSAGE);
    }

    try {
      const payload = await this.jwtService.verifyAsync<
        Record<string, unknown>
      >(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      request.user = this.validateAccessTokenPayload(payload);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(AccessTokenGuard.UNAUTHORIZED_MESSAGE);
    }
  }

  private extractBearerToken(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }

    const parts = authorization.split(' ');

    if (parts.length !== 2) {
      return null;
    }

    const [scheme, token] = parts;

    if (scheme !== 'Bearer' || token.length === 0) {
      return null;
    }

    return token;
  }

  private validateAccessTokenPayload(
    payload: Record<string, unknown>,
  ): AccessTokenPayload {
    if (
      'sessionId' in payload &&
      typeof payload.sessionId === 'string' &&
      payload.sessionId.length > 0
    ) {
      throw new UnauthorizedException(AccessTokenGuard.UNAUTHORIZED_MESSAGE);
    }

    const sub = payload.sub;
    const email = payload.email;
    const role = payload.role;

    if (typeof sub !== 'string' || sub.trim().length === 0) {
      throw new UnauthorizedException(AccessTokenGuard.UNAUTHORIZED_MESSAGE);
    }

    if (typeof email !== 'string' || email.trim().length === 0) {
      throw new UnauthorizedException(AccessTokenGuard.UNAUTHORIZED_MESSAGE);
    }

    if (!this.isValidRole(role)) {
      throw new UnauthorizedException(AccessTokenGuard.UNAUTHORIZED_MESSAGE);
    }

    return {
      sub,
      email,
      role,
    };
  }

  private isValidRole(role: unknown): role is Role {
    return (
      typeof role === 'string' && Object.values(Role).includes(role as Role)
    );
  }
}
