import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../access-control/decorators/current-user.decorator';
import { AccessTokenGuard } from '../access-control/guards/access-token.guard';
import type { AccessTokenPayload } from '../auth/types/auth.types';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UsersService } from './users.service';
import { THROTTLE_AUTH } from '../common/throttling/throttle.constants';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
@SkipThrottle({ [THROTTLE_AUTH]: true })
export class UsersController {
  private static readonly UNAUTHORIZED_MESSAGE = 'Unauthorized.';

  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({
    description: 'Authenticated user profile',
    type: UserProfileResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token',
  })
  async getMe(@CurrentUser() user: AccessTokenPayload) {
    const profile = await this.usersService.findById(user.sub);

    if (!profile || !profile.isActive) {
      throw new UnauthorizedException(UsersController.UNAUTHORIZED_MESSAGE);
    }

    return profile;
  }
}
