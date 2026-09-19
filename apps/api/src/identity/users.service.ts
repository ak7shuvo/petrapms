import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './identity.types';

/**
 * Every method here takes tenant context only from an AuthenticatedUser
 * (never a route param or DTO field), and every tenant-owned query below
 * includes an explicit tenantId filter. This is the "centralized
 * data-access layer" required by /docs/MULTI-TENANCY.md — as more
 * tenant-owned tables arrive in later phases, follow this same shape
 * rather than filtering by tenant ad hoc in controllers.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getSelf(caller: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: caller.userId },
      include: { tenant: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isPlatformAdmin: user.isPlatformAdmin,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      tenant: user.tenant
        ? { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug }
        : null,
    };
  }

  /**
   * Lists users belonging to the caller's own tenant only. Platform
   * admins have no single tenant and are out of scope for this endpoint
   * (cross-tenant user listing belongs to the future Administration
   * module — see /docs/MODULE-ARCHITECTURE.md).
   */
  async listForCallerTenant(caller: AuthenticatedUser) {
    if (caller.isPlatformAdmin || !caller.tenantId) {
      throw new ForbiddenException(
        'Platform accounts do not have a tenant-scoped user list.',
      );
    }

    const users = await this.prisma.user.findMany({
      where: { tenantId: caller.tenantId }, // mandatory tenant filter
      orderBy: { createdAt: 'asc' },
      include: { role: true },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      role: u.role ? { id: u.role.id, name: u.role.name } : null,
    }));
  }
}
