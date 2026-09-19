'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser, fetchHotel, fetchInvoices,
  type CurrentUser, type Hotel, type InvoiceListItem, type InvoiceStatus,
} from '../../../lib/api-client';
import { Shell } from '../../../components/shell';

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: '#6b7280', ISSUED: '#2563eb', PARTIALLY_PAID: '#d97706',
  PAID: '#16a34a', VOID: '#dc2626',
};

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (hId: string) => {
    try {
      const list = await fetchInvoices(hId);
      setInvoices(list);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel().then((h) => { setHotel(h); return load(h.id); }).catch(() => null);
      })
      .catch(() => router.replace('/login'));
  }, [router, load]);

  if (!user) return <Loading />;

  if (!hotel) {
    return (
      <Shell user={user}>
        <h1 style={s.h1}>Billing</h1>
        <p style={s.empty}>Configure your hotel first. <a href="/dashboard/hotel" style={s.link}>Hotel Settings →</a></p>
      </Shell>
    );
  }

  const total = invoices.reduce((n, i) => n + i.totalAmount, 0);
  const paid = invoices.reduce((n, i) => n + i.paidAmount, 0);
  const outstanding = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'PARTIALLY_PAID')
    .reduce((n, i) => n + i.balanceDue, 0);

  return (
    <Shell user={user}>
      <h1 style={s.h1}>Billing</h1>

      {error && <div style={s.errorBanner}>{error}</div>}

      <div style={s.statsRow}>
        <Stat label="Total invoiced" value={`$${total.toFixed(2)}`} />
        <Stat label="Collected" value={`$${paid.toFixed(2)}`} />
        <Stat label="Outstanding" value={`$${outstanding.toFixed(2)}`} accent />
      </div>

      {invoices.length === 0 ? (
        <p style={s.empty}>No invoices yet. Generate one from a stay in <a href="/dashboard/front-desk" style={s.link}>Front Desk</a>.</p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>{['Guest', 'Room', 'Total', 'Paid', 'Balance', 'Status', 'Created', ''].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} style={s.tr}>
                <td style={s.td}>{inv.guest ?? '—'}</td>
                <td style={s.td}>{inv.roomNumber ?? '—'}</td>
                <td style={s.td}>${inv.totalAmount.toFixed(2)}</td>
                <td style={s.td}>${inv.paidAmount.toFixed(2)}</td>
                <td style={s.td}>${inv.balanceDue.toFixed(2)}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, color: STATUS_COLOR[inv.status] }}>{inv.status.replace('_', ' ')}</span>
                </td>
                <td style={s.td}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                <td style={{ ...s.td, textAlign: 'right' }}>
                  <a href={`/dashboard/billing/${inv.id}`} style={s.viewLink}>View →</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={s.statCard}>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: accent ? '#dc2626' : '#111827' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Loading() {
  return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}><p>Loading…</p></main>;
}

const s: Record<string, React.CSSProperties> = {
  h1: { marginTop: 0, fontSize: '1.5rem', color: '#111827' },
  statsRow: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  statCard: { background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8, padding: '1rem 1.5rem', minWidth: 140 },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.6rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e4e8' },
  th: { textAlign: 'left' as const, padding: '0.6rem 0.75rem', borderBottom: '2px solid #e2e4e8', color: '#374151', fontSize: '0.75rem', textTransform: 'uppercase' as const, fontWeight: 700 },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.65rem 0.75rem', color: '#111827', verticalAlign: 'middle' as const },
  badge: { fontWeight: 600, fontSize: '0.8rem' },
  viewLink: { color: '#1a4d8f', textDecoration: 'none', fontWeight: 500, fontSize: '0.8rem' },
  empty: { color: '#6b7280', fontSize: '0.875rem' },
  link: { color: '#1a4d8f', textDecoration: 'none' },
};
