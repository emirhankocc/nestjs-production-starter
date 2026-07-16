import { applyDecorators } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { THROTTLE_AUTH, THROTTLE_DEFAULT } from './throttle.constants';

export function AuthThrottle(): MethodDecorator {
  return applyDecorators(
    SkipThrottle({ [THROTTLE_DEFAULT]: true }),
    Throttle({ [THROTTLE_AUTH]: {} }),
  );
}

export function GeneralThrottleOnly(): MethodDecorator {
  return applyDecorators(
    SkipThrottle({ [THROTTLE_AUTH]: true }),
    SkipThrottle({ [THROTTLE_DEFAULT]: false }),
  );
}
