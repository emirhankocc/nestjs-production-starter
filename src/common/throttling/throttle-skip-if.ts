import { ExecutionContext } from '@nestjs/common';

export function shouldSkipDocumentationThrottling(
  context: ExecutionContext,
): boolean {
  const request = context.switchToHttp().getRequest<{
    path?: string;
    url?: string;
  }>();
  const path = request.path ?? request.url ?? '';

  return path === '/docs' || path.startsWith('/docs/');
}
