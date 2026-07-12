import { Role } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
};

export type AuthTokensResponse = {
  user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken: string;
};
