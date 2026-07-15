import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AccessControlModule],
  controllers: [AdminController],
})
export class AdminModule {}
