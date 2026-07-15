import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessTokenGuard } from '../access-control/guards/access-token.guard';
import type { AccessTokenPayload } from '../auth/types/auth.types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: { findById: jest.Mock };

  const safeUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
    isActive: true,
    createdAt: new Date('2026-07-13T00:00:00.000Z'),
  };

  const accessPayload: AccessTokenPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
  };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    usersController = module.get(UsersController);
  });

  it('returns a safe profile for a valid active user', async () => {
    usersService.findById.mockResolvedValue(safeUser);

    const profile = await usersController.getMe(accessPayload);

    expect(profile).toEqual(safeUser);
    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('tokenHash');
  });

  it('calls UsersService.findById with payload.sub', async () => {
    usersService.findById.mockResolvedValue(safeUser);

    await usersController.getMe(accessPayload);

    expect(usersService.findById).toHaveBeenCalledWith(accessPayload.sub);
  });

  it('returns 401 when the user does not exist', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(usersController.getMe(accessPayload)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(usersController.getMe(accessPayload)).rejects.toThrow(
      'Unauthorized.',
    );
  });

  it('returns 401 when the user is inactive', async () => {
    usersService.findById.mockResolvedValue({
      ...safeUser,
      isActive: false,
    });

    await expect(usersController.getMe(accessPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('never returns passwordHash', async () => {
    usersService.findById.mockResolvedValue(safeUser);

    const profile = await usersController.getMe(accessPayload);

    expect(Object.keys(profile)).toEqual([
      'id',
      'email',
      'role',
      'isActive',
      'createdAt',
    ]);
  });
});
