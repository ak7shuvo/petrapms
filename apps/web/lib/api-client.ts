/**
 * API client — Phase 3 extension, Phase 10 auth-transport change.
 * Adds hotel, room type, and room endpoints to the Phase 2 auth client.
 *
 * Phase 10: tokens are no longer stored in `localStorage` or read by
 * client JS at all — the API sets them as httpOnly cookies at
 * login/register/refresh (see apps/api/src/identity/cookie.constants.ts),
 * and every request here sends `credentials: 'include'` so the browser
 * attaches them automatically. This closes the known XSS-exposure gap
 * documented as a known issue in every PROJECT-STATE.md since Phase 2 —
 * see docs/SECURITY-ARCHITECTURE.md — Token Storage.
 */
function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

// ─── Auth types (unchanged from Phase 2) ────────────────────────────────────

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
  role: { id: string; name: string } | null;
  tenant: TenantSummary | null;
}

// ─── Phase 3 types ───────────────────────────────────────────────────────────

export interface Hotel {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomType {
  id: string;
  name: string;
  description: string | null;
  baseRate: number;
  maxOccupancy: number;
  roomCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  number: string;
  floor: number | null;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  notes: string | null;
  roomType: { id: string; name: string; baseRate: number };
  createdAt: string;
  updatedAt: string;
}

// ─── Phase 4 types ───────────────────────────────────────────────────────────

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  nationality: string | null;
  documentNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Reservation {
  id: string;
  guest: { id: string; firstName: string; lastName: string };
  room: { id: string; number: string };
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  adults: number;
  children: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function authHeaders(): HeadersInit {
  // No Authorization header needed: the httpOnly cookie is sent
  // automatically by the browser via `credentials: 'include'` on every
  // call site below.
  return { 'Content-Type': 'application/json' };
}

// ─── Auth endpoints (Phase 2 — unchanged) ───────────────────────────────────

export async function login(email: string, password: string) {
  const res = await fetch(`${apiUrl()}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data = await res.json();
  return data;
}

export async function registerTenant(input: {
  tenantName: string;
  tenantSlug: string;
  adminEmail: string;
  adminPassword: string;
  firstName: string;
  lastName: string;
}) {
  const res = await fetch(`${apiUrl()}/v1/auth/register-tenant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data = await res.json();
  return data;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch(`${apiUrl()}/v1/auth/me`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${apiUrl()}/v1/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({}),
  }).catch(() => undefined); // best-effort — cookies are also short-lived
}

// ─── Hotel endpoints (Phase 3) ───────────────────────────────────────────────

export async function fetchHotel(): Promise<Hotel> {
  const res = await fetch(`${apiUrl()}/v1/hotels`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function upsertHotel(data: Partial<Omit<Hotel, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): Promise<Hotel> {
  const res = await fetch(`${apiUrl()}/v1/hotels`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Room Type endpoints (Phase 3) ───────────────────────────────────────────

export async function fetchRoomTypes(hotelId: string): Promise<RoomType[]> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/room-types`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function createRoomType(hotelId: string, data: { name: string; description?: string; baseRate: number; maxOccupancy: number }): Promise<RoomType> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/room-types`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function updateRoomType(hotelId: string, roomTypeId: string, data: Partial<{ name: string; description: string; baseRate: number; maxOccupancy: number }>): Promise<RoomType> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/room-types/${roomTypeId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function deleteRoomType(hotelId: string, roomTypeId: string): Promise<void> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/room-types/${roomTypeId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseErrorMessage(res));
}

// ─── Room endpoints (Phase 3) ────────────────────────────────────────────────

export async function fetchRooms(hotelId: string): Promise<Room[]> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/rooms`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function createRoom(hotelId: string, data: { roomTypeId: string; number: string; floor?: number; status?: string; notes?: string }): Promise<Room> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function updateRoom(hotelId: string, roomId: string, data: Partial<{ roomTypeId: string; number: string; floor: number; status: string; notes: string }>): Promise<Room> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/rooms/${roomId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function deleteRoom(hotelId: string, roomId: string): Promise<void> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/rooms/${roomId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseErrorMessage(res));
}

// ─── Guest endpoints (Phase 4) ────────────────────────────────────────────────

export async function fetchGuests(hotelId: string, opts?: { page?: number; limit?: number; search?: string }): Promise<Page<Guest>> {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.search) params.set('search', opts.search);
  const qs = params.toString();
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/guests${qs ? `?${qs}` : ''}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function createGuest(hotelId: string, data: { firstName: string; lastName: string; email?: string; phone?: string; address?: string; nationality?: string; documentNumber?: string; notes?: string }): Promise<Guest> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/guests`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function updateGuest(hotelId: string, guestId: string, data: Partial<{ firstName: string; lastName: string; email: string; phone: string; address: string; nationality: string; documentNumber: string; notes: string }>): Promise<Guest> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/guests/${guestId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function deleteGuest(hotelId: string, guestId: string): Promise<void> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/guests/${guestId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseErrorMessage(res));
}

// ─── Reservation endpoints (Phase 4) ──────────────────────────────────────────

export async function fetchReservations(hotelId: string, opts?: { page?: number; limit?: number; status?: ReservationStatus; roomId?: string; guestId?: string }): Promise<Page<Reservation>> {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.status) params.set('status', opts.status);
  if (opts?.roomId) params.set('roomId', opts.roomId);
  if (opts?.guestId) params.set('guestId', opts.guestId);
  const qs = params.toString();
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/reservations${qs ? `?${qs}` : ''}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function createReservation(hotelId: string, data: { guestId: string; roomId: string; checkInDate: string; checkOutDate: string; adults?: number; children?: number; notes?: string }): Promise<Reservation> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/reservations`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function updateReservation(hotelId: string, reservationId: string, data: Partial<{ guestId: string; roomId: string; checkInDate: string; checkOutDate: string; adults: number; children: number; notes: string; status: ReservationStatus }>): Promise<Reservation> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/reservations/${reservationId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function cancelReservation(hotelId: string, reservationId: string): Promise<Reservation> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/reservations/${reservationId}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Stay / Front Desk endpoints (Phase 5) ────────────────────────────────────

export type StayStatus = 'ACTIVE' | 'COMPLETED';

export interface Stay {
  id: string;
  status: StayStatus;
  checkInAt: string;
  checkOutAt: string | null;
  notes: string | null;
  guest: { id: string; firstName: string; lastName: string; email: string | null };
  room: { id: string; number: string; floor: number | null; roomType: { id: string; name: string } };
  reservation: { id: string; checkInDate: string; checkOutDate: string; status: ReservationStatus };
  createdAt: string;
  updatedAt: string;
}

export async function fetchStays(hotelId: string, opts?: { status?: StayStatus }): Promise<Stay[]> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  const qs = params.toString();
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/stays${qs ? `?${qs}` : ''}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function fetchArrivals(hotelId: string): Promise<Reservation[]> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/stays/arrivals`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function fetchDepartures(hotelId: string): Promise<Stay[]> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/stays/departures`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function checkIn(hotelId: string, data: { reservationId: string; notes?: string }): Promise<Stay> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/stays/check-in`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function checkOut(hotelId: string, stayId: string): Promise<Stay> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/stays/${stayId}/check-out`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Housekeeping types & endpoints (Phase 6) ────────────────────────────────

export interface HousekeepingEntry {
  roomId: string;
  roomNumber: string;
  floor: number | null;
  roomType: string;
  status: 'DIRTY' | 'IN_PROGRESS' | 'CLEAN' | 'INSPECTED';
  notes: string | null;
  updatedAt: string;
}

export async function fetchHousekeeping(hotelId: string): Promise<HousekeepingEntry[]> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/housekeeping`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function updateHousekeeping(
  hotelId: string,
  roomId: string,
  data: { status: HousekeepingEntry['status']; notes?: string },
): Promise<HousekeepingEntry> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/housekeeping/${roomId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Billing types & endpoints (Phase 7) ─────────────────────────────────────

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';

export interface InvoiceListItem {
  id: string;
  status: InvoiceStatus;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  issuedAt: string | null;
  dueDate: string | null;
  guest: string | null;
  roomNumber: string | null;
  paymentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  voidedAt: string | null;
}

export interface InvoiceDetail {
  id: string;
  status: InvoiceStatus;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  issuedAt: string | null;
  dueDate: string | null;
  notes: string | null;
  stay: {
    id: string; status: string; checkInAt: string; checkOutAt: string | null;
    guest: { id: string; firstName: string; lastName: string };
    room: { id: string; number: string; roomType: { name: string; baseRate: number } };
  } | null;
  lineItems: { id: string; description: string; quantity: number; unitPrice: number; amount: number }[];
  payments: InvoicePayment[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchInvoices(hotelId: string): Promise<InvoiceListItem[]> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/invoices`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function fetchInvoice(hotelId: string, invoiceId: string): Promise<InvoiceDetail> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/invoices/${invoiceId}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function fetchInvoiceByStay(hotelId: string, stayId: string): Promise<InvoiceDetail> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/stays/${stayId}/invoice`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function generateInvoice(hotelId: string, stayId: string, data: { dueDate?: string; notes?: string }): Promise<InvoiceDetail> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/stays/${stayId}/invoice/generate`, {
    method: 'POST', headers: authHeaders(), credentials: 'include' as RequestCredentials, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function issueInvoice(hotelId: string, invoiceId: string): Promise<InvoiceDetail> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/invoices/${invoiceId}/issue`, {
    method: 'POST', headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function voidInvoice(hotelId: string, invoiceId: string): Promise<InvoiceDetail> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/invoices/${invoiceId}/void`, {
    method: 'POST', headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function recordPayment(hotelId: string, invoiceId: string, data: { amount: number; method: PaymentMethod; reference?: string; notes?: string }): Promise<{ invoice: InvoiceDetail; payment: InvoicePayment }> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/invoices/${invoiceId}/payments`, {
    method: 'POST', headers: authHeaders(), credentials: 'include' as RequestCredentials, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function voidPayment(hotelId: string, invoiceId: string, paymentId: string): Promise<{ invoice: InvoiceDetail; payment: InvoicePayment }> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/invoices/${invoiceId}/payments/${paymentId}/void`, {
    method: 'POST', headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Reports types & endpoints (Phase 8) ─────────────────────────────────────

export interface DashboardSummary {
  hotelId: string;
  asOf: string;
  occupancy: { totalRooms: number; occupiedRooms: number; rate: number };
  revenueMonthToDate: { invoiced: number; collected: number; invoiceCount: number };
  pendingCheckouts: number;
}

export interface OccupancyReport {
  hotelId: string; from: string; to: string;
  totalRooms: number; averageOccupancyRate: number;
  days: { date: string; occupiedRooms: number; occupancyRate: number }[];
}

export interface RevenueReport {
  hotelId: string; from: string; to: string;
  totalInvoiced: number; totalCollected: number; totalOutstanding: number;
  invoiceCount: number; paymentCount: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
  days: { date: string; invoiced: number }[];
}

export interface StaySummaryReport {
  hotelId: string; from: string; to: string;
  totalStays: number; activeStays: number; completedStays: number;
  averageLengthOfStay: number;
  topRooms: { number: string; count: number }[];
}

export async function fetchDashboardSummary(hotelId: string): Promise<DashboardSummary> {
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/reports/summary`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function fetchOccupancyReport(hotelId: string, from?: string, to?: string): Promise<OccupancyReport> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/reports/occupancy${qs.toString() ? `?${qs}` : ''}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function fetchRevenueReport(hotelId: string, from?: string, to?: string): Promise<RevenueReport> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/reports/revenue${qs.toString() ? `?${qs}` : ''}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function fetchStaySummary(hotelId: string, from?: string, to?: string): Promise<StaySummaryReport> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const res = await fetch(`${apiUrl()}/v1/hotels/${hotelId}/reports/stays${qs.toString() ? `?${qs}` : ''}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Admin types (Phase 9) ────────────────────────────────────────────────────

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  userCount: number;
  hotelCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDetail extends TenantListItem {
  users: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    isPlatformAdmin: boolean;
    role: { id: string; name: string } | null;
    createdAt: string;
  }[];
  hotels: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    createdAt: string;
  }[];
}

// ─── Admin endpoints (Phase 9) ───────────────────────────────────────────────

export async function adminListTenants(): Promise<TenantListItem[]> {
  const res = await fetch(`${apiUrl()}/v1/admin/tenants`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function adminGetTenant(id: string): Promise<TenantDetail> {
  const res = await fetch(`${apiUrl()}/v1/admin/tenants/${id}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function adminUpdateTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<TenantListItem> {
  const res = await fetch(`${apiUrl()}/v1/admin/tenants/${id}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function adminProvisionTenant(data: {
  tenantName: string; tenantSlug: string; adminEmail: string;
  adminPassword: string; firstName: string; lastName: string;
}): Promise<TenantListItem> {
  const res = await fetch(`${apiUrl()}/v1/admin/tenants`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include' as RequestCredentials,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}
