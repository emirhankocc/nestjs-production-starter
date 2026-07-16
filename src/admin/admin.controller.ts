import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../access-control/decorators/roles.decorator';
import { AccessTokenGuard } from '../access-control/guards/access-token.guard';
import { RolesGuard } from '../access-control/guards/roles.guard';
import { AdminPingResponseDto } from './dto/admin-ping-response.dto';
import { THROTTLE_AUTH } from '../common/throttling/throttle.constants';

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
@SkipThrottle({ [THROTTLE_AUTH]: true })
@UseGuards(AccessTokenGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class AdminController {
  @Get('ping')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Verify admin access' })
  @ApiOkResponse({
    description: 'Admin access granted',
    type: AdminPingResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient role',
  })
  ping(): AdminPingResponseDto {
    return {
      status: 'ok',
      message: 'Admin access granted',
    };
  }
}
