/**
 * Phase 6 — Housekeeping tenant-isolation e2e tests.
 *
 * Proves:
 *  1. A newly created room gets a default (DIRTY) housekeeping status
 *     the first time the board is read, with no manual seeding needed.
 *  2. A tenant can update a room's housekeeping status.
 *  3. A user from Tenant A cannot read or update Tenant B's housekeeping
 *     board/rooms (404, never leaking existence of the other tenant's data).
 *  4. Protected endpoints reject unauthenticated requests.
 */
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function setupTenantWithRoom(
  app: INestApplication,
  suffix: string,
): Promise<{ token: string; hotelId: string; roomId: string }> {
  const reg = await request(app.getHttpServer())
    .post('/v1/auth/register-tenant')
    .send({
      tenantName: `Hotel ${suffix}`,
      tenantSlug: `hotel-hk-${suffix.toLowerCase()}-${Date.now()}`,
      adminEmail: `admin-hk-${suffix}-${Date.now()}@test.invalid`,
      adminPassword: 'Test1234!!',
      firstName: 'Admin',
      lastName: suffix,
    })
    .expect(201);

  const token = reg.body.accessToken;

  const hotelRes = await request(app.getHttpServer())
    .put('/v1/hotels')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Hotel ${suffix}` })
    .expect(200);
  const hotelId = hotelRes.body.id;

  const typeRes = await request(app.getHttpServer())
    .post(`/v1/hotels/${hotelId}/room-types`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Standard', baseRate: 100, maxOccupancy: 2 })
    .expect(201);

  const roomRes = await request(app.getHttpServer())
    .post(`/v1/hotels/${hotelId}/rooms`)
    .set('Authorization', `Bearer ${token}`)
    .send({ roomTypeId: typeRes.body.id, number: '101' })
    .expect(201);

  return { token, hotelId, roomId: roomRes.body.id };
}

describe('Housekeeping (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tenantA: { token: string; hotelId: string; roomId: string };
  let tenantB: { token: string; hotelId: string; roomId: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    tenantA = await setupTenantWithRoom(app, 'A');
    tenantB = await setupTenantWithRoom(app, 'B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('auto-creates a DIRTY default status the first time the board is read', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/hotels/${tenantA.hotelId}/housekeeping`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].roomId).toBe(tenantA.roomId);
    expect(res.body[0].status).toBe('DIRTY');
  });

  it('lets a tenant update their own room housekeeping status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/hotels/${tenantA.hotelId}/housekeeping/${tenantA.roomId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ status: 'CLEAN', notes: 'Turned down and restocked.' })
      .expect(200);

    expect(res.body.status).toBe('CLEAN');
    expect(res.body.notes).toBe('Turned down and restocked.');
  });

  it("blocks Tenant B from reading Tenant A's housekeeping board", async () => {
    await request(app.getHttpServer())
      .get(`/v1/hotels/${tenantA.hotelId}/housekeeping`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .expect(404);
  });

  it("blocks Tenant B from updating Tenant A's room via Tenant A's hotelId", async () => {
    await request(app.getHttpServer())
      .patch(`/v1/hotels/${tenantA.hotelId}/housekeeping/${tenantA.roomId}`)
      .set('Authorization', `Bearer ${tenantB.token}`)
      .send({ status: 'INSPECTED' })
      .expect(404);
  });

  it("blocks Tenant A from updating Tenant A's hotel but Tenant B's roomId (cross-tenant room reference)", async () => {
    await request(app.getHttpServer())
      .patch(`/v1/hotels/${tenantA.hotelId}/housekeeping/${tenantB.roomId}`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ status: 'INSPECTED' })
      .expect(404);
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .get(`/v1/hotels/${tenantA.hotelId}/housekeeping`)
      .expect(401);
  });

  it("Tenant A's confirmed CLEAN status persists and is not affected by Tenant B's data", async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/hotels/${tenantA.hotelId}/housekeeping`)
      .set('Authorization', `Bearer ${tenantA.token}`)
      .expect(200);

    expect(res.body[0].status).toBe('CLEAN');
  });
});
