/**
 * Phase 5 — Front Desk & Stay Operations e2e tests.
 *
 * Proves:
 *  1. Check-in only succeeds from a CONFIRMED reservation (PENDING and
 *     already-checked-in rejected with 409); room -> OCCUPIED, Stay -> ACTIVE.
 *  2. Check-out closes the Stay (-> COMPLETED), room -> AVAILABLE,
 *     reservation -> COMPLETED; a second check-out on the same stay is
 *     rejected (409).
 *  3. A user from Tenant A cannot check in/out or read Tenant B's
 *     reservations or stays (404s throughout).
 *  4. Protected endpoints reject unauthenticated requests.
 */
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function registerTenantWithRoom(
  app: INestApplication,
  suffix: string,
): Promise<{ token: string; hotelId: string; roomId: string }> {
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

  const hotelRes = await request(app.getHttpServer())
    .put('/v1/hotels')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Hotel ${suffix}`, city: 'Testville', country: 'Testland' })
    .expect(200);
  const hotelId = hotelRes.body.id;

  const rtRes = await request(app.getHttpServer())
    .post(`/v1/hotels/${hotelId}/room-types`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Standard', baseRate: 100, maxOccupancy: 2 })
    .expect(201);

  const roomRes = await request(app.getHttpServer())
    .post(`/v1/hotels/${hotelId}/rooms`)
    .set('Authorization', `Bearer ${token}`)
    .send({ roomTypeId: rtRes.body.id, number: '101', floor: 1 })
    .expect(201);

  return { token, hotelId, roomId: roomRes.body.id };
}

async function createGuest(app: INestApplication, token: string, hotelId: string) {
  const res = await request(app.getHttpServer())
    .post(`/v1/hotels/${hotelId}/guests`)
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName: 'Jane', lastName: 'Doe' })
    .expect(201);
  return res.body.id as string;
}

/** Creates a reservation. Dates default to a range spanning today. */
async function createReservation(
  app: INestApplication,
  token: string,
  hotelId: string,
  guestId: string,
  roomId: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const res = await request(app.getHttpServer())
    .post(`/v1/hotels/${hotelId}/reservations`)
    .set('Authorization', `Bearer ${token}`)
    .send({ guestId, roomId, checkInDate: today, checkOutDate: tomorrow })
    .expect(201);
  return res.body.id as string;
}

async function confirmReservation(
  app: INestApplication,
  token: string,
  hotelId: string,
  reservationId: string,
) {
  await request(app.getHttpServer())
    .patch(`/v1/hotels/${hotelId}/reservations/${reservationId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'CONFIRMED' })
    .expect(200);
}

describe('Front Desk & Stay Operations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenA: string;
  let hotelIdA: string;
  let roomIdA: string;
  let guestIdA: string;

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

    const a = await registerTenantWithRoom(app, 'fd-alpha');
    tokenA = a.token;
    hotelIdA = a.hotelId;
    roomIdA = a.roomId;
    guestIdA = await createGuest(app, tokenA, hotelIdA);

    const b = await registerTenantWithRoom(app, 'fd-beta');
    tokenB = b.token;
    hotelIdB = b.hotelId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects check-in for a PENDING (not yet confirmed) reservation', async () => {
    const reservationId = await createReservation(app, tokenA, hotelIdA, guestIdA, roomIdA);

    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/stays/check-in`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ reservationId })
      .expect(409);

    // Clean up: cancel so it doesn't collide with the next test's booking.
    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations/${reservationId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
  });

  describe('a confirmed reservation', () => {
    let reservationId: string;
    let stayId: string;

    beforeAll(async () => {
      reservationId = await createReservation(app, tokenA, hotelIdA, guestIdA, roomIdA);
      await confirmReservation(app, tokenA, hotelIdA, reservationId);
    });

    it('appears in arrivals before check-in', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/hotels/${hotelIdA}/stays/arrivals`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.map((r: { id: string }) => r.id)).toContain(reservationId);
    });

    it('checks in: creates an ACTIVE stay and sets the room OCCUPIED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdA}/stays/check-in`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ reservationId })
        .expect(201);

      stayId = res.body.id;
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.reservation.id).toBe(reservationId);

      const roomRes = await request(app.getHttpServer())
        .get(`/v1/hotels/${hotelIdA}/rooms`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const room = roomRes.body.find((r: { id: string }) => r.id === roomIdA);
      expect(room.status).toBe('OCCUPIED');
    });

    it('rejects a second check-in of the same reservation', async () => {
      await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdA}/stays/check-in`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ reservationId })
        .expect(409);
    });

    it('appears in current occupancy while ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/hotels/${hotelIdA}/stays`)
        .query({ status: 'ACTIVE' })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).toContain(stayId);
    });

    it('checks out: closes the stay, frees the room, completes the reservation', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdA}/stays/${stayId}/check-out`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.checkOutAt).toBeTruthy();

      const roomRes = await request(app.getHttpServer())
        .get(`/v1/hotels/${hotelIdA}/rooms`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      const room = roomRes.body.find((r: { id: string }) => r.id === roomIdA);
      expect(room.status).toBe('AVAILABLE');

      const reservationRes = await request(app.getHttpServer())
        .get(`/v1/hotels/${hotelIdA}/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(reservationRes.body.status).toBe('COMPLETED');
    });

    it('rejects checking out the same stay twice', async () => {
      await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdA}/stays/${stayId}/check-out`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(409);
    });
  });

  describe('tenant isolation', () => {
    let reservationIdA: string;
    let stayIdA: string;

    beforeAll(async () => {
      // Fresh room for tenant A so this block doesn't collide with the
      // "a confirmed reservation" block above, which left roomIdA
      // AVAILABLE again but its dates already used.
      const rtRes = await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdA}/room-types`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Isolation Test Type', baseRate: 80, maxOccupancy: 2 })
        .expect(201);
      const roomRes = await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdA}/rooms`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ roomTypeId: rtRes.body.id, number: '202', floor: 2 })
        .expect(201);

      reservationIdA = await createReservation(
        app,
        tokenA,
        hotelIdA,
        guestIdA,
        roomRes.body.id,
      );
      await confirmReservation(app, tokenA, hotelIdA, reservationIdA);

      const checkInRes = await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdA}/stays/check-in`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ reservationId: reservationIdA })
        .expect(201);
      stayIdA = checkInRes.body.id;
    });

    it("tenant B cannot check in against tenant A's reservation, even via tenant B's own hotel path", async () => {
      await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdB}/stays/check-in`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ reservationId: reservationIdA })
        .expect(404);
    });

    it("tenant B cannot read tenant A's stay", async () => {
      await request(app.getHttpServer())
        .get(`/v1/hotels/${hotelIdB}/stays/${stayIdA}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it("tenant B cannot check out tenant A's stay", async () => {
      await request(app.getHttpServer())
        .post(`/v1/hotels/${hotelIdB}/stays/${stayIdA}/check-out`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it("tenant B's occupancy list never contains tenant A's stay", async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/hotels/${hotelIdB}/stays`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).not.toContain(stayIdA);
    });
  });

  it('rejects requests to stay endpoints with no token', async () => {
    await request(app.getHttpServer()).get(`/v1/hotels/${hotelIdA}/stays`).expect(401);
    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/stays/check-in`)
      .send({ reservationId: 'not-a-real-id' })
      .expect(401);
  });
});
