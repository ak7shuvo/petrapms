import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import {
  HOTEL_ADMINISTRATOR_PERMISSIONS,
  HOTEL_ADMINISTRATOR_ROLE_NAME,
} from '../identity/permissions.constants';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Administration (TEAM PETRA) service.
 *
 * Operates at platform scope — no tenantId filter, by design.
 * These methods must only be called from routes protected by
 * PlatformAdminGuard. They never expose one tenant's business
 * data to another — they aggregate metadata only.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Tenant listing & detail ──────────────────────────────────────────────

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true, hotels: true },
        },
      },
    });

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      userCount: t._count.users,
      hotelCount: t._count.hotels,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            isPlatformAdmin: true,
            role: { select: { id: true, name: true } },
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        hotels: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
            createdAt: true,
          },
        },
        _count: {
          select: { users: true, hotels: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found.');

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      userCount: tenant._count.users,
      hotelCount: tenant._count.hotels,
      users: tenant.users,
      hotels: tenant.hotels,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  // ─── Tenant status management ─────────────────────────────────────────────

  async updateTenantStatus(tenantId: string, dto: UpdateTenantStatusDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found.');

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: dto.status },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  // ─── Tenant provisioning ──────────────────────────────────────────────────

  /**
   * Platform-admin-initiated tenant creation — functionally similar to
   * self-service register-tenant but called by TEAM PETRA. Does NOT issue
   * auth tokens (the new tenant's admin should login themselves).
   */
  async provisionTenant(dto: ProvisionTenantDto) {
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (existingSlug) {
      throw new ConflictException('That tenant slug is already in use.');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingEmail) {
      throw new ConflictException('That email is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_SALT_ROUNDS);

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: HOTEL_ADMINISTRATOR_PERMISSIONS } },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug: dto.tenantSlug },
      });

      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: HOTEL_ADMINISTRATOR_ROLE_NAME,
          description: "Full administrative access to the tenant's workspace.",
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          roleId: adminRole.id,
        },
      });

      return { tenant, user };
    });

    return {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
      status: result.tenant.status,
      adminEmail: result.user.email,
      createdAt: result.tenant.createdAt,
    };
  }

  // ─── Platform admin bootstrap ─────────────────────────────────────────────

  /**
   * Creates the first TEAM PETRA platform admin account if none exists.
   * Called at API bootstrap when PLATFORM_ADMIN_EMAIL and
   * PLATFORM_ADMIN_PASSWORD env vars are set. Idempotent — safe to
   * re-run (skips if the account already exists).
   */
  async bootstrapPlatformAdmin(): Promise<void> {
    const email = process.env.PLATFORM_ADMIN_EMAIL;
    const password = process.env.PLATFORM_ADMIN_PASSWORD;

    if (!email || !password) return; // vars not set — skip silently

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Already exists — ensure it's marked as platform admin
      if (!existing.isPlatformAdmin) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { isPlatformAdmin: true },
        });
        console.log(`[bootstrap] Existing account ${email} promoted to platform admin.`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: process.env.PLATFORM_ADMIN_FIRST_NAME ?? 'Platform',
        lastName: process.env.PLATFORM_ADMIN_LAST_NAME ?? 'Admin',
        isPlatformAdmin: true,
        tenantId: null,
        roleId: null,
      },
    });

    console.log(`[bootstrap] Platform admin account created: ${email}`);
  }
}
