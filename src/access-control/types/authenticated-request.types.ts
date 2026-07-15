import { Request } from 'express';
import { AccessTokenPayload } from '../../auth/types/auth.types';

export type AuthenticatedRequest = Request & {
  user: AccessTokenPayload;
};
