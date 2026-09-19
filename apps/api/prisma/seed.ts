/**
 * Seeds shared reference data (Permission catalog) and backfills
 * existing tenant roles.
 *
 * Phase 5: the permission catalog is additive-only (see
 * /docs/USER-ROLES.md) — a role created at tenant-registration time
 * only ever gets the permissions that existed in HOTEL_ADMINISTRATOR_PERMISSIONS
 * at that moment. Every phase since Phase 3 has grown that list, but
 * nothing previously re-granted the new keys to roles created earlier
 * (flagged as an overdue gap in PROJECT-STATE.md, three phases running).
 * This backfill closes that gap: for every existing "Hotel Administrator"
 * role, grant any permission in HOTEL_ADMINISTRATOR_PERMISSIONS it's
 * still missing. Idempotent — safe to re-run on every deploy.
 *
 * Run after `prisma db push` or `prisma migrate deploy`.
 */
import { PrismaClient } from '@prisma/client';
import {
  PERMISSIONS,
  HOTEL_ADMINISTRATOR_PERMISSIONS,
  HOTEL_ADMINISTRATOR_ROLE_NAME,
} from '../src/identity/permissions.constants';

const prisma = new PrismaClient();

async function seedPermissionCatalog() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    });
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions.`);
}

async function backfillHotelAdministratorRoles() {
  const permissions = await prisma.permission.findMany({
    where: { key: { in: HOTEL_ADMINISTRATOR_PERMISSIONS } },
  });
  const permissionIds = new Map(permissions.map((p) => [p.key, p.id]));

  const roles = await prisma.role.findMany({
    where: { name: HOTEL_ADMINISTRATOR_ROLE_NAME, tenantId: { not: null } },
    include: { permissions: { select: { permissionId: true } } },
  });

  let grantedCount = 0;
  for (const role of roles) {
    const alreadyGranted = new Set(role.permissions.map((rp) => rp.permissionId));
    const missing = HOTEL_ADMINISTRATOR_PERMISSIONS.filter((key) => {
      const id = permissionIds.get(key);
      return id !== undefined && !alreadyGranted.has(id);
    });
    if (missing.length === 0) continue;

    await prisma.rolePermission.createMany({
      data: missing.map((key) => ({
        roleId: role.id,
        permissionId: permissionIds.get(key)!,
      })),
      skipDuplicates: true,
    });
    grantedCount += missing.length;
  }

  console.log(
    `Backfilled ${grantedCount} missing permission grant(s) across ${roles.length} existing "${HOTEL_ADMINISTRATOR_ROLE_NAME}" role(s).`,
  );
}

async function main() {
  await seedPermissionCatalog();
  await backfillHotelAdministratorRoles();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
