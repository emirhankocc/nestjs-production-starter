import { Role } from '@prisma/client';

export type SafeUser = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};

export type UserWithPassword = SafeUser & {
  passwordHash: string;
};

export type CreateUserInput = {
  email: string;
  passwordHash: string;
};
