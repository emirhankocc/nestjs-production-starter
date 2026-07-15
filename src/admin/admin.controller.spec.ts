import { Test, TestingModule } from '@nestjs/testing';
import { AccessTokenGuard } from '../access-control/guards/access-token.guard';
import { RolesGuard } from '../access-control/guards/roles.guard';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  let adminController: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    adminController = module.get(AdminController);
  });

  it('returns the admin ping response', () => {
    expect(adminController.ping()).toEqual({
      status: 'ok',
      message: 'Admin access granted',
    });
  });
});
