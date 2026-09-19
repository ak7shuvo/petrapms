'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser, fetchHotel,
  fetchDashboardSummary, fetchOccupancyReport,
  fetchRevenueReport, fetchStaySummary,
  type CurrentUser, type Hotel, type DashboardSummary,
  type OccupancyReport, type RevenueReport, type StaySummaryReport,
} from '../../../lib/api-client';
import { Shell } from '../../../components/shell';

type Tab = 'overview' | 'occupancy' | 'revenue' | 'stays';

function fmt(n: number) { return `$${n.toFixed(2)}`; }
function pct(n: number) { return `${n}%`; }

// Simple inline bar component — no external chart library needed
function Bar({ value, max, color = '#1a4d8f' }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: 8, background: '#e2e4e8', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [stays, setStays] = useState<StaySummaryReport | null>(null);

  // Date range (default last 30 days)
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo] = useState(today);

  const load = useCallback(async (hId: string, f: string, t: string) => {
    setError(null);
    try {
      const [s, o, r, st] = await Promise.all([
        fetchDashboardSummary(hId),
        fetchOccupancyReport(hId, f, t),
        fetchRevenueReport(hId, f, t),
        fetchStaySummary(hId, f, t),
      ]);
      setSummary(s); setOccupancy(o); setRevenue(r); setStays(st);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel().then((h) => { setHotel(h); return load(h.id, from, to); }).catch(() => null);
      })
      .catch(() => router.replace('/login'));
  }, []);

  const applyRange = () => { if (hotel) load(hotel.id, from, to); };

  if (!user) return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}><p>Loading…</p></main>;

  if (!hotel) {
    return <Shell user={user}><h1 style={s.h1}>Reports</h1><p style={s.muted}>Configure your hotel first.</p></Shell>;
  }

  return (
    <Shell user={user}>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>Reports</h1>
        <div style={s.dateRow}>
          <input type="date" style={s.dateInput} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span style={{ color: '#6b7280' }}>→</span>
          <input type="date" style={s.dateInput} value={to} onChange={(e) => setTo(e.target.value)} />
          <button style={s.applyBtn} onClick={applyRange}>Apply</button>
        </div>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {/* Tabs */}
      <div style={s.tabs}>
        {(['overview', 'occupancy', 'revenue', 'stays'] as Tab[]).map((t) => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && summary && (
        <div>
          <div style={s.cardRow}>
            <KpiCard label="Occupancy rate" value={pct(summary.occupancy.rate)}
              sub={`${summary.occupancy.occupiedRooms} / ${summary.occupancy.totalRooms} rooms`} />
            <KpiCard label="MTD invoiced" value={fmt(summary.revenueMonthToDate.invoiced)}
              sub={`${summary.revenueMonthToDate.invoiceCount} invoice${summary.revenueMonthToDate.invoiceCount !== 1 ? 's' : ''}`} />
            <KpiCard label="MTD collected" value={fmt(summary.revenueMonthToDate.collected)} />
            <KpiCard label="Pending checkouts" value={String(summary.pendingCheckouts)}
              accent={summary.pendingCheckouts > 0} />
          </div>
          {occupancy && (
            <Section title="Occupancy (last 30 days)">
              <div style={s.barChart}>
                {occupancy.days.slice(-14).map((d) => (
                  <div key={d.date} style={s.barCol}>
                    <div style={{ ...s.barFill, height: `${Math.max(4, d.occupancyRate)}%`, background: d.occupancyRate >= 80 ? '#16a34a' : d.occupancyRate >= 50 ? '#1a4d8f' : '#d97706' }} title={`${d.date}: ${d.occupancyRate}%`} />
                    <span style={s.barLabel}>{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Occupancy tab */}
      {tab === 'occupancy' && occupancy && (
        <div>
          <div style={s.cardRow}>
            <KpiCard label="Total rooms" value={String(occupancy.totalRooms)} />
            <KpiCard label="Avg occupancy" value={pct(occupancy.averageOccupancyRate)} />
          </div>
          <Section title={`Daily occupancy: ${occupancy.from} → ${occupancy.to}`}>
            <table style={s.table}>
              <thead><tr>{['Date', 'Occupied', 'Total', 'Rate'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {occupancy.days.map((d) => (
                  <tr key={d.date} style={s.tr}>
                    <td style={s.td}>{d.date}</td>
                    <td style={s.td}>{d.occupiedRooms}</td>
                    <td style={s.td}>{occupancy.totalRooms}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 36, fontSize: '0.8rem' }}>{pct(d.occupancyRate)}</span>
                        <div style={{ flex: 1 }}><Bar value={d.occupancyRate} max={100} color={d.occupancyRate >= 80 ? '#16a34a' : '#1a4d8f'} /></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      )}

      {/* Revenue tab */}
      {tab === 'revenue' && revenue && (
        <div>
          <div style={s.cardRow}>
            <KpiCard label="Total invoiced" value={fmt(revenue.totalInvoiced)} sub={`${revenue.invoiceCount} invoices`} />
            <KpiCard label="Collected" value={fmt(revenue.totalCollected)} sub={`${revenue.paymentCount} payments`} />
            <KpiCard label="Outstanding" value={fmt(revenue.totalOutstanding)} accent={revenue.totalOutstanding > 0} />
          </div>
          {Object.keys(revenue.byMethod).length > 0 && (
            <Section title="Payment methods">
              <div style={s.cardRow}>
                {Object.entries(revenue.byMethod).map(([method, amt]) => (
                  <KpiCard key={method} label={method.replace('_', ' ')} value={fmt(amt)} />
                ))}
              </div>
            </Section>
          )}
          {revenue.days.length > 0 && (
            <Section title="Daily invoiced">
              <table style={s.table}>
                <thead><tr>{['Date', 'Invoiced'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {revenue.days.map((d) => (
                    <tr key={d.date} style={s.tr}>
                      <td style={s.td}>{d.date}</td>
                      <td style={s.td}><strong>{fmt(d.invoiced)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      )}

      {/* Stays tab */}
      {tab === 'stays' && stays && (
        <div>
          <div style={s.cardRow}>
            <KpiCard label="Total stays" value={String(stays.totalStays)} />
            <KpiCard label="Active" value={String(stays.activeStays)} />
            <KpiCard label="Completed" value={String(stays.completedStays)} />
            <KpiCard label="Avg length of stay" value={`${stays.averageLengthOfStay} nights`} />
          </div>
          {stays.topRooms.length > 0 && (
            <Section title="Top rooms by stay count">
              <table style={s.table}>
                <thead><tr>{['Room', 'Stays'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {stays.topRooms.map((r) => (
                    <tr key={r.number} style={s.tr}>
                      <td style={s.td}>Room {r.number}</td>
                      <td style={s.td}>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      )}
    </Shell>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={s.kpi}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent ? '#dc2626' : '#111827' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>{title}</h2>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  h1: { marginTop: 0, fontSize: '1.5rem', color: '#111827' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' as const, gap: '0.75rem' },
  dateRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  dateInput: { padding: '0.35rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.875rem' },
  applyBtn: { padding: '0.35rem 0.85rem', background: '#1a4d8f', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.875rem' },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.6rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  tabs: { display: 'flex', borderBottom: '2px solid #e2e4e8', marginBottom: '1.5rem' },
  tab: { padding: '0.5rem 1.1rem', border: 'none', borderBottom: '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280', marginBottom: -2 },
  tabActive: { color: '#1a4d8f', borderBottomColor: '#1a4d8f', fontWeight: 600 },
  cardRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap' as const, marginBottom: '1.5rem' },
  kpi: { background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8, padding: '1rem 1.25rem', minWidth: 130 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem', background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8 },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e4e8', color: '#374151', fontSize: '0.75rem', textTransform: 'uppercase' as const, fontWeight: 700 },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.6rem 0.75rem', color: '#111827' },
  muted: { color: '#6b7280', fontSize: '0.875rem' },
  barChart: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '0.5rem', background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8, overflowX: 'auto' as const },
  barCol: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, flex: '0 0 auto', width: 28 },
  barFill: { width: '100%', borderRadius: 2, minHeight: 4, transition: 'height 0.3s' },
  barLabel: { fontSize: '0.6rem', color: '#9ca3af', textAlign: 'center' as const },
};
