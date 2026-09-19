import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../identity/identity.types';

/**
 * Injects the authenticated user (from the verified JWT, via JwtAuthGuard)
 * into a controller method. This — never a route param or query string —
 * is the only sanctioned source of tenant context for a request handler.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
