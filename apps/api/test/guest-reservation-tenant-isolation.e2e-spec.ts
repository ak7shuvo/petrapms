/**
 * Phase 4 — Guest & Reservation Management e2e tests.
 *
 * Proves:
 *  1. A tenant can create guests and reservations against their own hotel.
 *  2. A user from Tenant A cannot access Tenant B's guests or reservations.
 *  3. Overlapping-date bookings on the same room are rejected (409).
 *  4. Non-overlapping bookings on the same room succeed.
 *  5. Reservation state transitions follow the allowed state machine
 *     (PENDING -> CONFIRMED -> COMPLETED, and cancellation), and invalid
 *     transitions are rejected.
 *  6. Protected endpoints reject unauthenticated requests.
 */
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function registerTenantWithRoom(
  app: INestApplication,
  suffix: string,
): Promise<{ token: string; hotelId: string; roomTypeId: string; roomId: string }> {
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
  const roomTypeId = rtRes.body.id;

  const roomRes = await request(app.getHttpServer())
    .post(`/v1/hotels/${hotelId}/rooms`)
    .set('Authorization', `Bearer ${token}`)
    .send({ roomTypeId, number: '101', floor: 1 })
    .expect(201);
  const roomId = roomRes.body.id;

  return { token, hotelId, roomTypeId, roomId };
}

async function createGuest(
  app: INestApplication,
  token: string,
  hotelId: string,
  overrides: Partial<{ firstName: string; lastName: string; email: string }> = {},
) {
  const res = await request(app.getHttpServer())
    .post(`/v1/hotels/${hotelId}/guests`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: overrides.firstName ?? 'Jane',
      lastName: overrides.lastName ?? 'Doe',
      email: overrides.email,
    })
    .expect(201);
  return res.body.id as string;
}

describe('Guest & Reservation Management (e2e)', () => {
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

    const a = await registerTenantWithRoom(app, 'g-alpha');
    tokenA = a.token;
    hotelIdA = a.hotelId;
    roomIdA = a.roomId;
    guestIdA = await createGuest(app, tokenA, hotelIdA);

    const b = await registerTenantWithRoom(app, 'g-beta');
    tokenB = b.token;
    hotelIdB = b.hotelId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // ─── Guests ────────────────────────────────────────────────────────────────

  it('GET /v1/hotels/:id/guests — lists this tenant\'s guests (paginated envelope)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/guests`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta).toHaveProperty('total');
  });

  it('GET /v1/hotels/:id/guests — rejects unauthenticated', () =>
    request(app.getHttpServer()).get(`/v1/hotels/${hotelIdA}/guests`).expect(401));

  it('Tenant B cannot access Tenant A guests', async () => {
    await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/guests`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  // ─── Reservations — creation & double-booking ────────────────────────────────

  let reservationIdA: string;

  it('POST /v1/hotels/:id/reservations — creates a reservation', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        guestId: guestIdA,
        roomId: roomIdA,
        checkInDate: '2027-01-10',
        checkOutDate: '2027-01-15',
      })
      .expect(201);
    reservationIdA = res.body.id;
    expect(res.body.status).toBe('PENDING');
  });

  it('POST reservations — rejects overlapping dates on the same room (409)', async () => {
    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        guestId: guestIdA,
        roomId: roomIdA,
        checkInDate: '2027-01-12', // overlaps 10-15
        checkOutDate: '2027-01-18',
      })
      .expect(409);
  });

  it('POST reservations — accepts non-overlapping dates on the same room', async () => {
    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        guestId: guestIdA,
        roomId: roomIdA,
        checkInDate: '2027-01-15', // check-out day is free (half-open interval)
        checkOutDate: '2027-01-20',
      })
      .expect(201);
  });

  it('POST reservations — rejects checkOutDate <= checkInDate', async () => {
    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        guestId: guestIdA,
        roomId: roomIdA,
        checkInDate: '2027-02-10',
        checkOutDate: '2027-02-10',
      })
      .expect(400);
  });

  it('Tenant B cannot access Tenant A reservations', async () => {
    await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/reservations`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('Tenant B cannot create a reservation against Tenant A\'s room', async () => {
    // Tenant B has no guest yet; create one first in B's own hotel.
    const guestIdB = await createGuest(app, tokenB, hotelIdB, { firstName: 'Bob' });
    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdB}/reservations`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        guestId: guestIdB,
        roomId: roomIdA, // belongs to tenant A, not B
        checkInDate: '2027-03-01',
        checkOutDate: '2027-03-05',
      })
      .expect(404);
  });

  // ─── Reservation state transitions ───────────────────────────────────────────

  it('PATCH reservation — PENDING -> CONFIRMED is allowed', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/hotels/${hotelIdA}/reservations/${reservationIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('PATCH reservation — CONFIRMED -> PENDING is rejected (invalid transition)', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/hotels/${hotelIdA}/reservations/${reservationIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'PENDING' })
      .expect(409);
  });

  it('PATCH reservation — CONFIRMED -> COMPLETED is allowed', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/hotels/${hotelIdA}/reservations/${reservationIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('PATCH reservation — COMPLETED is terminal, further edits rejected', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/hotels/${hotelIdA}/reservations/${reservationIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ notes: 'too late' })
      .expect(409);
  });

  it('POST reservations/:id/cancel — PENDING reservation can be cancelled', async () => {
    const created = await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        guestId: guestIdA,
        roomId: roomIdA,
        checkInDate: '2027-04-01',
        checkOutDate: '2027-04-03',
      })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');
  });

  it('POST reservations/:id/cancel — cancelling an already-cancelled reservation is rejected', async () => {
    const created = await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        guestId: guestIdA,
        roomId: roomIdA,
        checkInDate: '2027-05-01',
        checkOutDate: '2027-05-03',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(409);
  });

  it('A cancelled reservation frees the room for the same dates', async () => {
    // Room is free again for 2027-05-01..2027-05-03 since the prior
    // reservation covering it was cancelled in the previous test.
    await request(app.getHttpServer())
      .post(`/v1/hotels/${hotelIdA}/reservations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        guestId: guestIdA,
        roomId: roomIdA,
        checkInDate: '2027-05-01',
        checkOutDate: '2027-05-03',
      })
      .expect(201);
  });

  // ─── Guest deletion guard ─────────────────────────────────────────────────────

  it('DELETE guest — rejected while the guest has reservations (409)', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/hotels/${hotelIdA}/guests/${guestIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(409);
  });
});
