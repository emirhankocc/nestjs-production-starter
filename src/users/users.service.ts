import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserInput,
  SafeUser,
  UserWithPassword,
} from './types/user.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async findByEmail(email: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: this.safeUserSelect(),
    });

    return user;
  }

  async findByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: {
        ...this.safeUserSelect(),
        passwordHash: true,
      },
    });

    return user;
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.safeUserSelect(),
    });

    return user;
  }

  async createUser(
    input: CreateUserInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SafeUser> {
    const client = tx ?? this.prisma;

    try {
      return await client.user.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          email: this.normalizeEmail(input.email),
          passwordHash: input.passwordHash,
        },
        select: this.safeUserSelect(),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }

      throw new InternalServerErrorException('Unable to create user');
    }
  }

  private safeUserSelect() {
    return {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    } satisfies Prisma.UserSelect;
  }
}
