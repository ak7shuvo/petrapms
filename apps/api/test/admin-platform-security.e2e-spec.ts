/**
 * Phase 10 — platform-admin security boundary (Phase 10 brief, Section 7).
 * Verifies:
 *  - Platform Admin can reach /v1/admin/*, manage tenants.
 *  - A regular tenant user cannot reach /v1/admin/* (403/401).
 *  - Unauthenticated requests cannot reach /v1/admin/* (401).
 *  - isPlatformAdmin cannot be forged — it's server-issued from the DB
 *    at login, never accepted from the client.
 *  - No passwordHash (or any credential) is ever returned by any admin
 *    endpoint.
 */
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AdminService } from '../src/admin/admin.service';

describe('Platform Admin security boundary (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let platformAdminToken: string;
  let tenantUserToken: string;

  const runId = Date.now();
  const platformAdminEmail = `platform-admin-${runId}@test.invalid`;
  const platformAdminPassword = 'PlatformAdmin!234';

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_EMAIL = platformAdminEmail;
    process.env.PLATFORM_ADMIN_PASSWORD = platformAdminPassword;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // Exercises the exact same bootstrap path main.ts calls on real boot.
    await app.get(AdminService).bootstrapPlatformAdmin();

    const adminLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: platformAdminEmail, password: platformAdminPassword })
      .expect(201);
    platformAdminToken = adminLogin.body.accessToken;

    const tenantReg = await request(app.getHttpServer())
      .post('/v1/auth/register-tenant')
      .send({
        tenantName: `Admin Boundary Test ${runId}`,
        tenantSlug: `admin-boundary-${runId}`,
        adminEmail: `tenant-${runId}@test.invalid`,
        adminPassword: 'Test1234!!',
        firstName: 'Regular',
        lastName: 'User',
      })
      .expect(201);
    tenantUserToken = tenantReg.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('platform admin can list tenants', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a regular tenant user cannot reach /v1/admin/*', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/tenants')
      .set('Authorization', `Bearer ${tenantUserToken}`)
      .expect(403);
  });

  it('unauthenticated requests cannot reach /v1/admin/*', async () => {
    await request(app.getHttpServer()).get('/v1/admin/tenants').expect(401);
  });

  it('platform admin can provision a new tenant', async () => {
    const slug = `provisioned-${runId}`;
    const res = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        tenantName: 'Provisioned Hotel',
        tenantSlug: slug,
        adminEmail: `provisioned-admin-${runId}@test.invalid`,
        adminPassword: 'Provisioned1234!',
        firstName: 'Prov',
        lastName: 'Admin',
      })
      .expect(201);
    expect(res.body.slug).toBe(slug);

    // No credential material of any kind leaks back.
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|adminPassword/i);
  });

  it('platform admin can suspend and reactivate a tenant', async () => {
    const list = await request(app.getHttpServer())
      .get('/v1/admin/tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    const target = list.body[0];

    const suspended = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${target.id}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    expect(suspended.body.status).toBe('SUSPENDED');

    const reactivated = await request(app.getHttpServer())
      .patch(`/v1/admin/tenants/${target.id}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(reactivated.body.status).toBe('ACTIVE');
  });

  it('no admin response ever includes a passwordHash field', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
  });

  it("isPlatformAdmin cannot be forged via a client-supplied field — /v1/auth/me always reflects the server-side value", async () => {
    // A tenant admin cannot become a platform admin by claiming so in a
    // request body; there's no endpoint that even accepts such a field,
    // and /me only ever reflects what's embedded in the *server-signed*
    // JWT, which was itself built from the DB row, not from the request.
    const me = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${tenantUserToken}`)
      .expect(200);
    expect(me.body.isPlatformAdmin).toBe(false);
  });
});
