/**
 * Phase 8 — Reports e2e tests.
 *
 * Proves:
 *  1. /reports/summary returns correct occupancy and MTD revenue shape.
 *  2. /reports/occupancy returns a daily series within the date range.
 *  3. /reports/revenue totals match what was invoiced and paid.
 *  4. /reports/stays counts match actual stays created.
 *  5. Tenant B cannot access Tenant A's report endpoints (404).
 *  6. Unauthenticated requests rejected (401).
 *  7. Cross-tenant aggregates never bleed: Tenant A's revenue report
 *     never includes invoices created for Tenant B.
 */
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function buildTenant(app: INestApplication, tag: string) {
  const slug = `reports-${tag}-${Date.now()}`;
  const reg = await request(app.getHttpServer())
    .post('/v1/auth/register-tenant')
    .send({
      tenantName: `Reports Hotel ${tag}`, tenantSlug: slug,
      adminEmail: `admin-${slug}@test.invalid`, adminPassword: 'Test1234!!',
      firstName: 'Admin', lastName: tag,
    })
    .expect(201);
  const token: string = reg.body.accessToken;
  const s = app.getHttpServer();

  const hotel = await request(s).put('/v1/hotels').set('Authorization', `Bearer ${token}`)
    .send({ name: `Reports Hotel ${tag}` }).expect(200);
  const hotelId: string = hotel.body.id;

  const rt = await request(s).post(`/v1/hotels/${hotelId}/room-types`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Standard', baseRate: 200, maxOccupancy: 2 }).expect(201);

  const room = await request(s).post(`/v1/hotels/${hotelId}/rooms`)
    .set('Authorization', `Bearer ${token}`)
    .send({ roomTypeId: rt.body.id, number: '101' }).expect(201);

  const guest = await request(s).post(`/v1/hotels/${hotelId}/guests`)
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName: 'Test', lastName: 'Guest' }).expect(201);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const res = await request(s).post(`/v1/hotels/${hotelId}/reservations`)
    .set('Authorization', `Bearer ${token}`)
    .send({ guestId: guest.body.id, roomId: room.body.id, checkInDate: today, checkOutDate: tomorrow })
    .expect(201);

  const reservationId = res.body.id as string;

  await request(s)
    .patch(`/v1/hotels/${hotelId}/reservations/${reservationId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'CONFIRMED' })
    .expect(200);

  const stay = await request(s).post(`/v1/hotels/${hotelId}/stays/check-in`)
    .set('Authorization', `Bearer ${token}`)
    .send({ reservationId: res.body.id }).expect(201);
  const stayId: string = stay.body.id;

  // Generate + issue invoice + record payment
  const inv = await request(s)
    .post(`/v1/hotels/${hotelId}/stays/${stayId}/invoice/generate`)
    .set('Authorization', `Bearer ${token}`).send({}).expect(201);
  await request(s).post(`/v1/hotels/${hotelId}/invoices/${inv.body.id}/issue`)
    .set('Authorization', `Bearer ${token}`).expect(200);
  await request(s).post(`/v1/hotels/${hotelId}/invoices/${inv.body.id}/payments`)
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: inv.body.totalAmount, method: 'CASH' }).expect(201);

  return { token, hotelId, stayId, invoiceTotal: inv.body.totalAmount as number };
}

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string, hotelIdA: string, invoiceTotalA: number;
  let tokenB: string, hotelIdB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const a = await buildTenant(app, 'alpha');
    tokenA = a.token; hotelIdA = a.hotelId; invoiceTotalA = a.invoiceTotal;

    const b = await buildTenant(app, 'beta');
    tokenB = b.token; hotelIdB = b.hotelId;
  });

  afterAll(async () => { await prisma.$disconnect(); await app.close(); });

  // ─── Summary ──────────────────────────────────────────────────────────────

  it('GET /reports/summary — returns occupancy and MTD revenue', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/reports/summary`)
      .set('Authorization', `Bearer ${tokenA}`).expect(200);

    expect(res.body).toHaveProperty('occupancy');
    expect(res.body.occupancy.totalRooms).toBe(1);
    expect(res.body.occupancy.occupiedRooms).toBe(1);
    expect(res.body.occupancy.rate).toBe(100);
    expect(res.body).toHaveProperty('revenueMonthToDate');
    expect(res.body.revenueMonthToDate.invoiceCount).toBeGreaterThanOrEqual(1);
    expect(res.body.revenueMonthToDate.collected).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('pendingCheckouts');
  });

  // ─── Occupancy ────────────────────────────────────────────────────────────

  it('GET /reports/occupancy — returns daily series', async () => {
    const from = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const res = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/reports/occupancy?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${tokenA}`).expect(200);

    expect(res.body.totalRooms).toBe(1);
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.days.length).toBe(3); // from, yesterday, today
    // Today should show 100% occupancy
    const today = res.body.days.find((d: any) => d.date === to);
    expect(today.occupancyRate).toBe(100);
  });

  // ─── Revenue ──────────────────────────────────────────────────────────────

  it('GET /reports/revenue — totals match invoiced amount', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/reports/revenue`)
      .set('Authorization', `Bearer ${tokenA}`).expect(200);

    expect(res.body.totalInvoiced).toBeCloseTo(invoiceTotalA, 2);
    expect(res.body.totalCollected).toBeCloseTo(invoiceTotalA, 2);
    expect(res.body.invoiceCount).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('byMethod');
    expect(res.body.byMethod.CASH).toBeCloseTo(invoiceTotalA, 2);
  });

  it('Revenue report never includes Tenant B data', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/reports/revenue`)
      .set('Authorization', `Bearer ${tokenA}`).expect(200);
    // Tenant B also has an invoice; A's total should exactly match A's invoice
    expect(res.body.totalInvoiced).toBeCloseTo(invoiceTotalA, 2);
  });

  // ─── Stay summary ─────────────────────────────────────────────────────────

  it('GET /reports/stays — counts match actual stays', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/reports/stays`)
      .set('Authorization', `Bearer ${tokenA}`).expect(200);

    expect(res.body.totalStays).toBeGreaterThanOrEqual(1);
    expect(res.body.activeStays).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('topRooms');
    expect(res.body.topRooms[0].number).toBe('101');
  });

  // ─── Tenant isolation ─────────────────────────────────────────────────────

  it('Tenant B cannot access Tenant A hotel reports (404)', () =>
    request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/reports/summary`)
      .set('Authorization', `Bearer ${tokenB}`).expect(404));

  it('Unauthenticated request rejected (401)', () =>
    request(app.getHttpServer())
      .get(`/v1/hotels/${hotelIdA}/reports/summary`).expect(401));
});
