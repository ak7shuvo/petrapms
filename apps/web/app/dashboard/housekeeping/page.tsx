'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  fetchHotel,
  fetchHousekeeping,
  updateHousekeeping,
  type CurrentUser,
  type Hotel,
  type HousekeepingEntry,
} from '../../../lib/api-client';
import { Shell } from '../../../components/shell';

const STATUS_LABELS: Record<string, string> = {
  DIRTY: 'Dirty',
  IN_PROGRESS: 'In Progress',
  CLEAN: 'Clean',
  INSPECTED: 'Inspected',
};

const STATUS_COLORS: Record<string, string> = {
  DIRTY: '#dc2626',
  IN_PROGRESS: '#d97706',
  CLEAN: '#16a34a',
  INSPECTED: '#1a4d8f',
};

export default function HousekeepingPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [entries, setEntries] = useState<HousekeepingEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (hotelId: string) => {
    setEntries(await fetchHousekeeping(hotelId));
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel()
          .then((h) => { setHotel(h); return load(h.id); })
          .catch(() => null);
      })
      .catch(() => router.replace('/login'));
  }, [router, load]);

  const handleStatusChange = async (entry: HousekeepingEntry, status: string) => {
    if (!hotel) return;
    setError(null);
    try {
      await updateHousekeeping(hotel.id, entry.roomId, { status: status as HousekeepingEntry['status'] });
      await load(hotel.id);
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
        <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>Housekeeping</h1>
        <p style={{ color: '#6b7280' }}>
          Configure your hotel profile first.{' '}
          <a href="/dashboard/hotel" style={{ color: '#1a4d8f' }}>Go to Hotel Settings →</a>
        </p>
      </Shell>
    );
  }

  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Shell user={user}>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>Housekeeping</h1>
        <span style={s.hotelLabel}>{hotel.name}</span>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      <div style={s.summary}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} style={s.summaryChip}>
            <span style={{ ...s.dot, background: STATUS_COLORS[key] }} />
            {label}: <strong>{counts[key] ?? 0}</strong>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <p style={s.empty}>No rooms yet. Add rooms under Rooms first.</p>
      ) : (
        <div style={s.grid}>
          {entries.map((entry) => (
            <div key={entry.roomId} style={{ ...s.card, borderTopColor: STATUS_COLORS[entry.status] }}>
              <div style={s.cardTop}>
                <strong style={s.roomNumber}>{entry.roomNumber}</strong>
                <span style={s.floor}>{entry.floor != null ? `Floor ${entry.floor}` : ''}</span>
              </div>
              <div style={s.roomType}>{entry.roomType}</div>
              <select
                style={{ ...s.statusSelect, color: STATUS_COLORS[entry.status] }}
                value={entry.status}
                onChange={(e) => handleStatusChange(entry, e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {entry.notes && <div style={s.notes}>{entry.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' },
  h1: { margin: 0, fontSize: '1.5rem', color: '#111827' },
  hotelLabel: { fontSize: '0.85rem', color: '#6b7280' },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.6rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  summary: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  summaryChip: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#374151' },
  dot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block' },
  empty: { color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' },
  card: { background: '#fff', border: '1px solid #e2e4e8', borderTop: '4px solid', borderRadius: 8, padding: '0.75rem' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  roomNumber: { fontSize: '1.05rem', color: '#111827' },
  floor: { fontSize: '0.75rem', color: '#9ca3af' },
  roomType: { fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' },
  statusSelect: { width: '100%', padding: '0.3rem', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
  notes: { marginTop: '0.5rem', fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' },
};
