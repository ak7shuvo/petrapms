'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  fetchHotel,
  fetchArrivals,
  fetchDepartures,
  fetchStays,
  checkIn,
  checkOut,
  type CurrentUser,
  type Hotel,
  type Reservation,
  type Stay,
} from '../../../lib/api-client';
import { Shell } from '../../../components/shell';

/**
 * Front Desk dashboard (see /docs/DEVELOPMENT-PHASES.md, Phase 5 —
 * "Front desk dashboard showing arrivals/departures and check-in/out
 * actions"). Three panels: today's arrivals (confirmed, not yet checked
 * in), today's departures (active stays due to check out), and current
 * occupancy (all active stays).
 */
export default function FrontDeskPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [departures, setDepartures] = useState<Stay[]>([]);
  const [occupancy, setOccupancy] = useState<Stay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (hotelId: string) => {
    const [a, d, o] = await Promise.all([
      fetchArrivals(hotelId),
      fetchDepartures(hotelId),
      fetchStays(hotelId, { status: 'ACTIVE' }),
    ]);
    setArrivals(a);
    setDepartures(d);
    setOccupancy(o);
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel()
          .then(async (h) => {
            setHotel(h);
            await load(h.id);
          })
          .catch(() => null);
      })
      .catch(() => router.replace('/login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleCheckIn = async (reservation: Reservation) => {
    if (!hotel) return;
    setBusyId(reservation.id);
    setError(null);
    try {
      await checkIn(hotel.id, { reservationId: reservation.id });
      await load(hotel.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleCheckOut = async (stay: Stay) => {
    if (!hotel) return;
    setBusyId(stay.id);
    setError(null);
    try {
      await checkOut(hotel.id, stay.id);
      await load(hotel.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
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
        <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>Front Desk</h1>
        <p style={{ color: '#6b7280' }}>
          Configure your hotel profile first.{' '}
          <a href="/dashboard/hotel" style={{ color: '#1a4d8f' }}>Go to Hotel Settings →</a>
        </p>
      </Shell>
    );
  }

  return (
    <Shell user={user}>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>Front Desk</h1>
        <span style={s.hotelLabel}>{hotel.name}</span>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      <div style={s.grid}>
        <section style={s.panel}>
          <h2 style={s.h2}>Arrivals ({arrivals.length})</h2>
          {arrivals.length === 0 ? (
            <p style={s.empty}>No confirmed reservations awaiting check-in.</p>
          ) : (
            arrivals.map((r) => (
              <div key={r.id} style={s.row}>
                <div>
                  <strong>{r.guest.firstName} {r.guest.lastName}</strong>
                  <div style={s.rowSub}>Room {r.room.number} · from {r.checkInDate}</div>
                </div>
                <button
                  style={s.actionBtn}
                  disabled={busyId === r.id}
                  onClick={() => handleCheckIn(r)}
                >
                  {busyId === r.id ? 'Checking in…' : 'Check in'}
                </button>
              </div>
            ))
          )}
        </section>

        <section style={s.panel}>
          <h2 style={s.h2}>Departures ({departures.length})</h2>
          {departures.length === 0 ? (
            <p style={s.empty}>No active stays due to check out today.</p>
          ) : (
            departures.map((st) => (
              <div key={st.id} style={s.row}>
                <div>
                  <strong>{st.guest.firstName} {st.guest.lastName}</strong>
                  <div style={s.rowSub}>Room {st.room.number} · until {st.reservation.checkOutDate}</div>
                </div>
                <button
                  style={s.dangerBtn}
                  disabled={busyId === st.id}
                  onClick={() => handleCheckOut(st)}
                >
                  {busyId === st.id ? 'Checking out…' : 'Check out'}
                </button>
              </div>
            ))
          )}
        </section>

        <section style={{ ...s.panel, gridColumn: '1 / -1' }}>
          <h2 style={s.h2}>Current Occupancy ({occupancy.length})</h2>
          {occupancy.length === 0 ? (
            <p style={s.empty}>No rooms currently occupied.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Guest', 'Room', 'Checked in', 'Expected check-out', ''].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {occupancy.map((st) => (
                  <tr key={st.id} style={s.tr}>
                    <td style={s.td}><strong>{st.guest.firstName} {st.guest.lastName}</strong></td>
                    <td style={s.td}>Room {st.room.number} · {st.room.roomType.name}</td>
                    <td style={s.td}>{new Date(st.checkInAt).toLocaleString()}</td>
                    <td style={s.td}>{st.reservation.checkOutDate}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <button
                        style={s.dangerBtn}
                        disabled={busyId === st.id}
                        onClick={() => handleCheckOut(st)}
                      >
                        {busyId === st.id ? 'Checking out…' : 'Check out'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Shell>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' },
  h1: { margin: 0, fontSize: '1.5rem', color: '#111827' },
  h2: { margin: '0 0 0.75rem', fontSize: '1rem', color: '#111827' },
  hotelLabel: { fontSize: '0.85rem', color: '#6b7280' },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.6rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' },
  panel: { background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8, padding: '1.25rem' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' },
  rowSub: { color: '#6b7280', fontSize: '0.8rem', marginTop: 2 },
  empty: { color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic' },
  actionBtn: { padding: '0.35rem 0.8rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.8rem' },
  dangerBtn: { padding: '0.35rem 0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.8rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e4e8', color: '#374151', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.65rem 0.75rem', color: '#111827', verticalAlign: 'middle' as const },
};
