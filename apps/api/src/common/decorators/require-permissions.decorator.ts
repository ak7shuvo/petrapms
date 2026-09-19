import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Marks an endpoint as requiring one or more permission keys, evaluated
 * together with the caller's tenant context by PermissionsGuard (see
 * /docs/SECURITY-ARCHITECTURE.md — Authorization (RBAC)).
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
