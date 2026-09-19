import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../../identity/identity.types';

/**
 * Runs after JwtAuthGuard. Checks that the caller's role (always looked
 * up by the role id embedded in their own token, never a client-supplied
 * id) grants every permission key required by the route.
 *
 * Per /docs/API-ARCHITECTURE.md, every protected operation checks both
 * "does this user have the required permission" AND, implicitly, that it
 * operates within their own tenant — this guard only answers the first
 * question; tenant scoping of the underlying data query is a separate,
 * mandatory responsibility of the service/repository layer (see
 * /docs/MULTI-TENANCY.md — "Required Safeguards for Shared-Schema
 * Isolation").
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new ForbiddenException('Not authenticated.');

    // Platform admins operate outside tenant-role RBAC entirely; this
    // guard is only for tenant-scoped, role-based endpoints.
    if (user.isPlatformAdmin) return true;

    if (!user.roleId) {
      throw new ForbiddenException('Account has no role assigned.');
    }

    const role = await this.prisma.role.findUnique({
      where: { id: user.roleId },
      include: { permissions: { include: { permission: true } } },
    });

    if (!role || role.tenantId !== user.tenantId) {
      // A role that no longer belongs to the caller's own tenant (e.g.
      // tenant reassignment edge case) is never trusted.
      throw new ForbiddenException('Role is not valid for this tenant.');
    }

    const grantedKeys = new Set(role.permissions.map((rp) => rp.permission.key));
    const hasAll = required.every((key) => grantedKeys.has(key));
    if (!hasAll) {
      throw new ForbiddenException('Missing required permission.');
    }

    return true;
  }
}
