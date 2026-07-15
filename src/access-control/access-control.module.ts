import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [JwtModule.register({})],
  providers: [AccessTokenGuard, RolesGuard],
  exports: [AccessTokenGuard, RolesGuard, JwtModule],
})
export class AccessControlModule {}
