/**
 * Phase 10 — closes the suspended-tenant gap flagged in every
 * PROJECT-STATE.md since Phase 9: a suspended tenant must not be able to
 * authenticate, AND (the immediate-enforcement model chosen — see
 * docs/SECURITY-ARCHITECTURE.md) a user already holding a valid access
 * token from before the suspension must be locked out of protected
 * endpoints on their very next request, not just unable to log in again.
 */
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Suspended tenant enforcement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const slug = `susp-${Date.now()}`;
  const email = `admin-${slug}@test.invalid`;
  const password = 'Test1234!!!';
  let accessToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer())
      .post('/v1/auth/register-tenant')
      .send({
        tenantName: `Suspend Test ${slug}`,
        tenantSlug: slug,
        adminEmail: email,
        adminPassword: password,
        firstName: 'Susp',
        lastName: 'Tenant',
      })
      .expect(201);

    accessToken = reg.body.accessToken;

    const me = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    tenantId = me.body.tenant.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('an ACTIVE tenant can log in', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(201);
  });

  it('the token works against a protected endpoint before suspension', async () => {
    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  describe('once the tenant is suspended', () => {
    beforeAll(async () => {
      await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'SUSPENDED' } });
    });

    afterAll(async () => {
      // Restore, so this suite doesn't leak state into others if run in
      // the same worker/database.
      await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } });
    });

    it('login is rejected (403), with the same generic-enough response shape as any other auth failure', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(403);
      expect(res.body.message).toMatch(/suspended/i);
    });

    it('a wrong password on a suspended tenant still returns the identical generic 401 — suspension is never revealed to a bad guess', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: 'wrong-password-entirely' })
        .expect(401);
    });

    it('an already-issued access token is rejected on the very next protected request (immediate enforcement)', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('the same already-issued token is also rejected on an ordinary tenant-scoped business endpoint', async () => {
      await request(app.getHttpServer())
        .get('/v1/hotels')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  it('reactivating the tenant restores login', async () => {
    await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'SUSPENDED' } });
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(403);

    await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } });
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
  });
});
