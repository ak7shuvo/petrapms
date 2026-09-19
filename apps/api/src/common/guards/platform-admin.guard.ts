import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../identity/identity.types';

/**
 * Rejects any caller that is not a TEAM PETRA platform admin
 * (isPlatformAdmin !== true). Applied to every /v1/admin/* route.
 *
 * Platform admins operate entirely outside tenant-scoped RBAC —
 * their access is gated by the isPlatformAdmin flag in the JWT,
 * not by role permissions (see /docs/USER-ROLES.md and
 * /docs/SECURITY-ARCHITECTURE.md).
 *
 * Must run AFTER JwtAuthGuard (which populates req.user).
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) throw new ForbiddenException('Not authenticated.');

    if (!user.isPlatformAdmin) {
      throw new ForbiddenException(
        'This endpoint is restricted to TEAM PETRA platform administrators.',
      );
    }

    return true;
  }
}
