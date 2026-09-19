/**
 * Phase 10 — Section 22: full end-to-end business workflow.
 *
 * Runs the entire real-hotel lifecycle against the live NestJS app (in
 * declaration order, each `it` building on state from the previous one):
 * tenant creation -> hotel setup -> guest -> reservation -> check-in ->
 * housekeeping -> invoice -> payment -> check-out -> reports -> platform
 * admin suspend/reactivate -> tenant login rejected then restored.
 *
 * This is intentionally one long ordered spec (not independent tests)
 * because the workflow IS the thing being verified — each step's
 * postcondition is the next step's precondition, exactly as a real front
 * desk would use the system.
 */
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AdminService } from '../src/admin/admin.service';

describe('Full hotel business workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = Date.now();

  let tenantToken: string;
  let tenantId: string;
  let hotelId: string;
  let roomTypeId: string;
  let roomId: string;
  let guestId: string;
  let reservationId: string;
  let stayId: string;
  let invoiceId: string;

  let platformAdminToken: string;

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_EMAIL = `platform-${runId}@test.invalid`;
    process.env.PLATFORM_ADMIN_PASSWORD = 'PlatformAdmin!234';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await app.get(AdminService).bootstrapPlatformAdmin();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${tenantToken}` });

  it('1-3. creates a tenant + admin user, and logs in', async () => {
    await api()
      .post('/v1/auth/register-tenant')
      .send({
        tenantName: `Workflow Hotel ${runId}`,
        tenantSlug: `workflow-${runId}`,
        adminEmail: `workflow-admin-${runId}@test.invalid`,
        adminPassword: 'WorkflowTest1234!!',
        firstName: 'Work',
        lastName: 'Flow',
      })
      .expect(201);

    const login = await api()
      .post('/v1/auth/login')
      .send({ email: `workflow-admin-${runId}@test.invalid`, password: 'WorkflowTest1234!!' })
      .expect(201);
    tenantToken = login.body.accessToken;

    const me = await api().get('/v1/auth/me').set(auth()).expect(200);
    tenantId = me.body.tenant.id;
    expect(me.body.tenant.slug).toBe(`workflow-${runId}`);
  });

  it('4. configures the hotel', async () => {
    const res = await api()
      .put('/v1/hotels')
      .set(auth())
      .send({ name: 'Workflow Grand Hotel', city: 'Testville', country: 'Testland' })
      .expect(200);
    hotelId = res.body.id;
  });

  it('5. creates a room type', async () => {
    const res = await api()
      .post(`/v1/hotels/${hotelId}/room-types`)
      .set(auth())
      .send({ name: 'Deluxe King', baseRate: 150, maxOccupancy: 2 })
      .expect(201);
    roomTypeId = res.body.id;
  });

  it('6. creates a room', async () => {
    const res = await api()
      .post(`/v1/hotels/${hotelId}/rooms`)
      .set(auth())
      .send({ roomTypeId, number: '501', floor: 5 })
      .expect(201);
    roomId = res.body.id;
  });

  it('7. creates a guest', async () => {
    const res = await api()
      .post(`/v1/hotels/${hotelId}/guests`)
      .set(auth())
      .send({ firstName: 'Alex', lastName: 'Traveler', email: `alex-${runId}@test.invalid` })
      .expect(201);
    guestId = res.body.id;
  });

  it('8. creates a reservation and confirms it', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const res = await api()
      .post(`/v1/hotels/${hotelId}/reservations`)
      .set(auth())
      .send({ guestId, roomId, checkInDate: today, checkOutDate: tomorrow })
      .expect(201);
    reservationId = res.body.id;

    await api()
      .patch(`/v1/hotels/${hotelId}/reservations/${reservationId}`)
      .set(auth())
      .send({ status: 'CONFIRMED' })
      .expect(200);
  });

  it('9. checks the guest in', async () => {
    const res = await api()
      .post(`/v1/hotels/${hotelId}/stays/check-in`)
      .set(auth())
      .send({ reservationId })
      .expect(201);
    stayId = res.body.id;
    expect(res.body.status).toBe('ACTIVE');
  });

  it('10. updates the housekeeping state for the room', async () => {
    const res = await api()
      .patch(`/v1/hotels/${hotelId}/housekeeping/${roomId}`)
      .set(auth())
      .send({ status: 'CLEAN' })
      .expect(200);
    expect(res.body.status).toBe('CLEAN');
  });

  it('11-12. generates and issues an invoice', async () => {
    const gen = await api()
      .post(`/v1/hotels/${hotelId}/stays/${stayId}/invoice/generate`)
      .set(auth())
      .send({})
      .expect(201);
    invoiceId = gen.body.id;
    expect(gen.body.status).toBe('DRAFT');

    const issued = await api()
      .post(`/v1/hotels/${hotelId}/invoices/${invoiceId}/issue`)
      .set(auth())
      .expect(200);
    expect(issued.body.status).toBe('ISSUED');
  });

  it('13. records a full payment', async () => {
    const invoice = await api()
      .get(`/v1/hotels/${hotelId}/invoices/${invoiceId}`)
      .set(auth())
      .expect(200);
    const total = invoice.body.totalAmount ?? invoice.body.total;

    const res = await api()
      .post(`/v1/hotels/${hotelId}/invoices/${invoiceId}/payments`)
      .set(auth())
      .send({ amount: total, method: 'CARD', reference: 'e2e-test' })
      .expect(201);
    expect(res.body.invoice.status).toBe('PAID');
  });

  it('14. checks the guest out', async () => {
    const res = await api()
      .post(`/v1/hotels/${hotelId}/stays/${stayId}/check-out`)
      .set(auth())
      .expect(201);
    expect(res.body.status).toBe('COMPLETED');

    const reservation = await api()
      .get(`/v1/hotels/${hotelId}/reservations/${reservationId}`)
      .set(auth())
      .expect(200);
    expect(reservation.body.status).toBe('COMPLETED');
  });

  it('15. views reports', async () => {
    const summary = await api().get(`/v1/hotels/${hotelId}/reports/summary`).set(auth()).expect(200);
    expect(summary.body).toBeDefined();

    const revenue = await api().get(`/v1/hotels/${hotelId}/reports/revenue`).set(auth()).expect(200);
    expect(revenue.body).toBeDefined();
  });

  it('16. platform admin views the tenant', async () => {
    const login = await api()
      .post('/v1/auth/login')
      .send({ email: process.env.PLATFORM_ADMIN_EMAIL, password: process.env.PLATFORM_ADMIN_PASSWORD })
      .expect(201);
    platformAdminToken = login.body.accessToken;

    const res = await api()
      .get(`/v1/admin/tenants/${tenantId}`)
      .set({ Authorization: `Bearer ${platformAdminToken}` })
      .expect(200);
    expect(res.body.id).toBe(tenantId);
  });

  it('17-18. platform admin suspends the tenant, and tenant login is rejected', async () => {
    await api()
      .patch(`/v1/admin/tenants/${tenantId}/status`)
      .set({ Authorization: `Bearer ${platformAdminToken}` })
      .send({ status: 'SUSPENDED' })
      .expect(200);

    await api()
      .post('/v1/auth/login')
      .send({ email: `workflow-admin-${runId}@test.invalid`, password: 'WorkflowTest1234!!' })
      .expect(403);
  });

  it('19-20. platform admin reactivates the tenant, and the tenant can log in again', async () => {
    await api()
      .patch(`/v1/admin/tenants/${tenantId}/status`)
      .set({ Authorization: `Bearer ${platformAdminToken}` })
      .send({ status: 'ACTIVE' })
      .expect(200);

    const res = await api()
      .post('/v1/auth/login')
      .send({ email: `workflow-admin-${runId}@test.invalid`, password: 'WorkflowTest1234!!' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
  });
});
