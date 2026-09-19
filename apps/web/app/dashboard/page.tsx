'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser, fetchHotel, type CurrentUser, type Hotel } from '../../lib/api-client';
import { Shell } from '../../components/shell';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel().then(setHotel).catch(() => null);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <Shell user={user}>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem', color: '#111827' }}>
        Welcome, {user.firstName}.
      </h1>
      {hotel ? (
        <div style={s.card}>
          <h2 style={s.cardTitle}>Your Property</h2>
          <dl style={s.dl}>
            <dt style={s.dt}>Hotel name</dt>
            <dd style={s.dd}>{hotel.name}</dd>
            {hotel.city && <><dt style={s.dt}>City</dt><dd style={s.dd}>{hotel.city}</dd></>}
            {hotel.country && <><dt style={s.dt}>Country</dt><dd style={s.dd}>{hotel.country}</dd></>}
            {hotel.phone && <><dt style={s.dt}>Phone</dt><dd style={s.dd}>{hotel.phone}</dd></>}
          </dl>
          <a href="/dashboard/hotel" style={s.link}>Edit hotel settings →</a>
        </div>
      ) : (
        <div style={s.card}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            No hotel configured yet. Set up your property to get started.
          </p>
          <a href="/dashboard/hotel" style={s.link}>Configure hotel →</a>
        </div>
      )}

      <div style={{ ...s.card, marginTop: '1rem' }}>
        <h2 style={s.cardTitle}>Quick links</h2>
        <div style={s.quickLinks}>
          <a href="/dashboard/hotel" style={s.quickLink}>🏨 Hotel Settings</a>
          <a href="/dashboard/rooms" style={s.quickLink}>🛏 Room Inventory</a>
          <a href="/dashboard/guests" style={s.quickLink}>🧳 Guests</a>
          <a href="/dashboard/reservations" style={s.quickLink}>📅 Reservations</a>
        </div>
      </div>
    </Shell>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8, padding: '1.5rem', maxWidth: 560 },
  cardTitle: { margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#374151' },
  dl: { display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '0.5rem', margin: '0 0 1rem' },
  dt: { color: '#6b7280', fontSize: '0.875rem', paddingTop: 2 },
  dd: { margin: 0, fontWeight: 500 },
  link: { color: '#1a4d8f', fontSize: '0.875rem', textDecoration: 'none', fontWeight: 500 },
  quickLinks: { display: 'flex', gap: '1rem', flexWrap: 'wrap' as const },
  quickLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #e2e4e8', color: '#374151', textDecoration: 'none', fontSize: '0.875rem', background: '#f9fafb' },
};
