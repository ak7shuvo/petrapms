/**
 * Phase 3 — Hotel, Room Type & Room tenant-isolation e2e tests.
 *
 * Proves:
 *  1. A tenant can configure their hotel profile.
 *  2. A tenant can create room types and rooms in their own hotel.
 *  3. A user from Tenant A cannot access Tenant B's hotel or rooms.
 *  4. Protected endpoints reject unauthenticated requests.
 */
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function registerTenantAndLogin(
  app: INestApplication,
  suffix: string,
): Promise<{ token: string; tenantId: string; hotelId: string }> {
  const reg = await request(app.getHttpServer())
    .post('/v1/auth/register-tenant')
    .send({
      tenantName: `Hotel ${suffix}`,
      tenantSlug: `hotel-${suffix}-${Date.now()}`,
      adminEmail: `admin-${suffix}-${Date.now()}@test.invalid`,
      adminPassword: 'Test1234!!',
      firstName: 'Admin',
      lastName: suffix,
    })
    .expect(201);

  const token = reg.body.accessToken;

  // Upsert hotel profile
  const hotelRes = await request(app.getHttpServer())
    .put('/v1/hotels')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Hotel ${suffix}`,
      city: 'Testville',
      country: 'Testland',
    })
    .expect(200);

  return { token, tenantId: reg.body.tenantId, hotelId: hotelRes.body.id };
}

describe('Hotel & Room Management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenA: string;
  let hotelIdA: string;
  let tokenB: string;
  let hotelIdB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const a = await registerTenantAndLogin(app, 'alpha');
    tokenA = a.token;
    hotelIdA = a.hotelId;

    const b = await registerTenantAndLogin(app, 'beta');
    tokenB = b.token;
    hotelIdB = b.hotelId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // ─── Hotel Profile ─────────────────────────────────────────────────────────

  it("GET /v1/hotels — returns this tenant's hotel", async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/hotels')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.name).toBe('Hotel alpha');
  });

  it('PATCH /v1/hotels — updates hotel fields', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/hotels')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ phone: '+1234567890' })
      .expect(200);
    expect(res.body.phone).toBe('+1234567890');
  });

  it('GET /v1/hotels — rejects unauthenticated', () =>
    request(app.getHttpServer()).get('/v1/hotels').expect(401));

  // ─── Room Types ────────────────────────────────────────────────────────────

  it('POST /v1/hotels/:id/room-types — creates a room type', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/room-types`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Deluxe King', baseRate: 150.0, maxOccupancy: 2 })
      .expect(201);
    expect(res.body.name).toBe('Deluxe King');
    expect(res.body.baseRate).toBe(150);
  });

  it('Tenant B cannot access Tenant A hotel room types', async () => {
    await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/room-types`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404); // hotel not found for tenant B's tenantId
  });

  it('POST /v1/hotels/:id/room-types — rejects duplicate name', async () => {
    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/room-types`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Deluxe King', baseRate: 160.0, maxOccupancy: 2 })
      .expect(409);
  });

  // ─── Rooms ─────────────────────────────────────────────────────────────────

  it('POST /v1/hotels/:id/rooms — creates a room', async () => {
    // First get the room type id
    const typesRes = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/room-types`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const roomTypeId = typesRes.body[0].id;

    const res = await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/rooms`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ roomTypeId, number: '101', floor: 1 })
      .expect(201);
    expect(res.body.number).toBe('101');
  });

  it('Tenant B cannot access Tenant A hotel rooms', async () => {
    await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/rooms`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('Tenant B rooms created by B never appear for A', async () => {
    // Create room type + room for B
    const rt = await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdB}/room-types`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Standard Twin', baseRate: 90, maxOccupancy: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdB}/rooms`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ roomTypeId: rt.body.id, number: '201', floor: 2 })
      .expect(201);

    // A listing rooms for its own hotel should not see B's rooms
    const aRooms = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/rooms`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const roomNumbers = aRooms.body.map((r: any) => r.number);
    expect(roomNumbers).not.toContain('201');
  });

  it('DELETE /v1/hotels/:id/rooms/:roomId — deletes a room', async () => {
    const typesRes = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/room-types`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const roomTypeId = typesRes.body[0].id;

    const created = await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/rooms`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ roomTypeId, number: '999' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/v1/hotels/${hotelIdA}/rooms/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);
  });
});
