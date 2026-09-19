import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Phase 2 required test (see /docs/DEVELOPMENT-RULES.md rule 13 and
 * /docs/MULTI-TENANCY.md "Testing discipline"): proves a user from one
 * tenant can never see another tenant's data through the API, and that
 * the tenant a request is scoped to always comes from the caller's own
 * token, never from anything the client supplies.
 *
 * Requires a real PostgreSQL database reachable via DATABASE_URL (see
 * docker-compose.yml), same as the Phase 1 health e2e test.
 */
describe('Auth & tenant isolation (e2e)', () => {
  let app: INestApplication;

  const unique = Date.now();
  const tenantA = { slug: `tenant-a-${unique}`, name: 'Tenant A Hotel' };
  const tenantB = { slug: `tenant-b-${unique}`, name: 'Tenant B Hotel' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function register(tenant: { slug: string; name: string }) {
    return request(app.getHttpServer())
      .post('/v1/auth/register-tenant')
      .send({
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        adminEmail: `admin-${tenant.slug}@example.com`,
        adminPassword: 'Sup3rSecret!Pass',
        firstName: 'Admin',
        lastName: tenant.name,
      });
  }

  it('registers two separate tenants with their own admin users', async () => {
    const resA = await register(tenantA).expect(201);
    const resB = await register(tenantB).expect(201);

    expect(resA.body.accessToken).toBeDefined();
    expect(resB.body.accessToken).toBeDefined();
  });

  it('rejects a login with the wrong password without revealing whether the account exists', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: `admin-${tenantA.slug}@example.com`,
        password: 'wrong-password',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(401);
  });

  it("GET /v1/auth/me reflects only the caller's own tenant", async () => {
    const loginA = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: `admin-${tenantA.slug}@example.com`,
        password: 'Sup3rSecret!Pass',
      })
      .expect(201);

    const me = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${loginA.body.accessToken}`)
      .expect(200);

    expect(me.body.tenant.slug).toBe(tenantA.slug);
  });

  it("GET /v1/users never returns another tenant's users", async () => {
    const loginA = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: `admin-${tenantA.slug}@example.com`,
        password: 'Sup3rSecret!Pass',
      })
      .expect(201);

    const loginB = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: `admin-${tenantB.slug}@example.com`,
        password: 'Sup3rSecret!Pass',
      })
      .expect(201);

    const usersA = await request(app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${loginA.body.accessToken}`)
      .expect(200);

    const usersB = await request(app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${loginB.body.accessToken}`)
      .expect(200);

    const emailsA = usersA.body.map((u: { email: string }) => u.email);
    const emailsB = usersB.body.map((u: { email: string }) => u.email);

    expect(emailsA).toContain(`admin-${tenantA.slug}@example.com`);
    expect(emailsA).not.toContain(`admin-${tenantB.slug}@example.com`);
    expect(emailsB).toContain(`admin-${tenantB.slug}@example.com`);
    expect(emailsB).not.toContain(`admin-${tenantA.slug}@example.com`);
  });

  it('rejects requests to protected endpoints with no token', async () => {
    await request(app.getHttpServer()).get('/v1/users').expect(401);
    await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
  });
});
