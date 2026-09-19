'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  fetchHotel,
  fetchGuests,
  fetchRooms,
  fetchReservations,
  createReservation,
  updateReservation,
  cancelReservation,
  type CurrentUser,
  type Hotel,
  type Guest,
  type Room,
  type Reservation,
  type ReservationStatus,
} from '../../../lib/api-client';
import { Shell } from '../../../components/shell';

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

const STATUS_COLORS: Record<ReservationStatus, string> = {
  PENDING: '#d97706',
  CONFIRMED: '#16a34a',
  CANCELLED: '#dc2626',
  COMPLETED: '#2563eb',
};

const EMPTY_FORM = { guestId: '', roomId: '', checkInDate: '', checkOutDate: '', adults: '1', children: '0', notes: '' };

export default function ReservationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const limit = 25;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (hotelId: string, p: number, status: ReservationStatus | '') => {
    const res = await fetchReservations(hotelId, { page: p, limit, status: status || undefined });
    setReservations(res.data);
    setTotal(res.meta.total);
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel()
          .then(async (h) => {
            setHotel(h);
            const [g, r] = await Promise.all([fetchGuests(h.id, { limit: 100 }), fetchRooms(h.id)]);
            setGuests(g.data);
            setRooms(r);
            await load(h.id, page, statusFilter);
          })
          .catch(() => null);
      })
      .catch(() => router.replace('/login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (hotel) load(hotel.id, page, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotel) return;
    setSaving(true);
    setError(null);
    try {
      await createReservation(hotel.id, {
        guestId: form.guestId,
        roomId: form.roomId,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        adults: form.adults ? parseInt(form.adults, 10) : undefined,
        children: form.children ? parseInt(form.children, 10) : undefined,
        notes: form.notes || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load(hotel.id, page, statusFilter);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (reservation: Reservation, status: ReservationStatus) => {
    if (!hotel) return;
    setError(null);
    try {
      await updateReservation(hotel.id, reservation.id, { status });
      await load(hotel.id, page, statusFilter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = async (reservation: Reservation) => {
    if (!hotel || !confirm(`Cancel the reservation for ${reservation.guest.firstName} ${reservation.guest.lastName}?`)) return;
    setError(null);
    try {
      await cancelReservation(hotel.id, reservation.id);
      await load(hotel.id, page, statusFilter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!hotel) {
    return (
      <Shell user={user}>
        <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>Reservations</h1>
        <p style={{ color: '#6b7280' }}>
          Configure your hotel profile first.{' '}
          <a href="/dashboard/hotel" style={{ color: '#1a4d8f' }}>Go to Hotel Settings →</a>
        </p>
      </Shell>
    );
  }

  const noRoomsOrGuests = rooms.length === 0 || guests.length === 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Shell user={user}>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>Reservations</h1>
        <span style={s.hotelLabel}>{hotel.name}</span>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {noRoomsOrGuests && (
        <p style={s.empty}>
          You need at least one room and one guest before creating a reservation.{' '}
          <a href="/dashboard/rooms" style={{ color: '#1a4d8f' }}>Add rooms →</a>{' '}
          <a href="/dashboard/guests" style={{ color: '#1a4d8f' }}>Add guests →</a>
        </p>
      )}

      <div style={s.toolbar}>
        <div style={s.filterGroup}>
          <label style={s.filterLabel}>Status</label>
          <select
            style={s.input}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as ReservationStatus | ''); setPage(1); }}
          >
            <option value="">All</option>
            {(Object.keys(STATUS_LABELS) as ReservationStatus[]).map((st) => (
              <option key={st} value={st}>{STATUS_LABELS[st]}</option>
            ))}
          </select>
        </div>
        <button
          style={s.addBtn}
          disabled={noRoomsOrGuests}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : '+ New reservation'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={s.inlineForm}>
          <select style={s.input} required value={form.guestId} onChange={(e) => setForm((f) => ({ ...f, guestId: e.target.value }))}>
            <option value="">Select guest *</option>
            {guests.map((g) => <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>)}
          </select>
          <select style={s.input} required value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}>
            <option value="">Select room *</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} · {r.roomType.name}</option>)}
          </select>
          <input style={s.input} type="date" required value={form.checkInDate} onChange={(e) => setForm((f) => ({ ...f, checkInDate: e.target.value }))} />
          <input style={s.input} type="date" required value={form.checkOutDate} onChange={(e) => setForm((f) => ({ ...f, checkOutDate: e.target.value }))} />
          <input style={{ ...s.input, minWidth: 90 }} type="number" min={1} max={20} placeholder="Adults" value={form.adults} onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))} />
          <input style={{ ...s.input, minWidth: 90 }} type="number" min={0} max={20} placeholder="Children" value={form.children} onChange={(e) => setForm((f) => ({ ...f, children: e.target.value }))} />
          <input style={{ ...s.input, minWidth: 220 }} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={1000} />
          <button type="submit" disabled={saving} style={s.saveBtn}>{saving ? 'Booking…' : 'Book'}</button>
        </form>
      )}

      {reservations.length === 0 ? (
        <p style={s.empty}>No reservations{statusFilter ? ` with status "${STATUS_LABELS[statusFilter]}"` : ''} yet.</p>
      ) : (
        <>
          <table style={s.table}>
            <thead>
              <tr>
                {['Guest', 'Room', 'Check-in', 'Check-out', 'Guests', 'Status', ''].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} style={s.tr}>
                  <td style={s.td}><strong>{r.guest.firstName} {r.guest.lastName}</strong></td>
                  <td style={s.td}>Room {r.room.number}</td>
                  <td style={s.td}>{r.checkInDate}</td>
                  <td style={s.td}>{r.checkOutDate}</td>
                  <td style={s.td}>{r.adults}{r.children > 0 ? ` + ${r.children}` : ''}</td>
                  <td style={s.td}>
                    <span style={{ ...s.statusBadge, color: STATUS_COLORS[r.status], borderColor: STATUS_COLORS[r.status] }}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.status === 'PENDING' && (
                      <button style={s.actionBtn} onClick={() => handleTransition(r, 'CONFIRMED')}>Confirm</button>
                    )}
                    {r.status === 'CONFIRMED' && (
                      <button style={s.actionBtn} onClick={() => handleTransition(r, 'COMPLETED')}>Complete</button>
                    )}
                    {(r.status === 'PENDING' || r.status === 'CONFIRMED') && (
                      <button style={s.dangerBtn} onClick={() => handleCancel(r)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={s.pagination}>
            <button style={s.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span style={s.pageInfo}>Page {page} of {totalPages} · {total} reservation{total === 1 ? '' : 's'}</span>
            <button style={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </>
      )}
    </Shell>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' },
  h1: { margin: 0, fontSize: '1.5rem', color: '#111827' },
  hotelLabel: { fontSize: '0.85rem', color: '#6b7280' },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.6rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' as const },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  filterLabel: { fontSize: '0.8rem', color: '#6b7280' },
  addBtn: { padding: '0.4rem 0.9rem', background: '#1a4d8f', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem' },
  inlineForm: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e2e4e8' },
  input: { padding: '0.4rem 0.65rem', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.875rem', minWidth: 140 },
  saveBtn: { padding: '0.4rem 0.9rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.875rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e4e8', color: '#374151', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.65rem 0.75rem', color: '#111827', verticalAlign: 'middle' as const },
  statusBadge: { display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 12, border: '1px solid', fontSize: '0.75rem', fontWeight: 600 },
  empty: { color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic' },
  actionBtn: { padding: '0.3rem 0.65rem', background: 'transparent', color: '#1a4d8f', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', marginRight: '0.4rem' },
  dangerBtn: { padding: '0.3rem 0.65rem', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.25rem' },
  pageBtn: { padding: '0.35rem 0.8rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', fontSize: '0.8rem' },
  pageInfo: { fontSize: '0.8rem', color: '#6b7280' },
};
