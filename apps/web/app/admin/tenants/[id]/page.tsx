'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  fetchCurrentUser,
  adminGetTenant,
  adminUpdateTenantStatus,
  type CurrentUser,
  type TenantDetail,
} from '../../../../lib/api-client';
import { AdminShell } from '../../../../components/admin-shell';

export default function TenantDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    const t = await adminGetTenant(id);
    setTenant(t);
  };

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        if (!u.isPlatformAdmin) { router.replace('/dashboard'); return; }
        setUser(u);
        return load();
      })
      .catch(() => router.replace('/login'));
  }, [id]);

  const toggleStatus = async () => {
    if (!tenant) return;
    setToggling(true);
    setError(null);
    try {
      const next = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await adminUpdateTenantStatus(tenant.id, next);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setToggling(false);
    }
  };

  if (!user || !tenant) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#0f1117', color: '#e2e8f0' }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <AdminShell user={user}>
      <div style={s.pageHeader}>
        <div>
          <a href="/admin" style={s.back}>← All tenants</a>
          <h1 style={s.h1}>{tenant.name}</h1>
          <span style={s.slug}>{tenant.slug}</span>
        </div>
        <button
          style={tenant.status === 'ACTIVE' ? s.suspendBtn : s.activateBtn}
          disabled={toggling}
          onClick={toggleStatus}
        >
          {toggling ? '…' : tenant.status === 'ACTIVE' ? 'Suspend tenant' : 'Activate tenant'}
        </button>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      <div style={s.statsRow}>
        <Kv label="Status">
          <span style={{ color: tenant.status === 'ACTIVE' ? '#4ade80' : '#f87171', fontWeight: 700 }}>
            {tenant.status}
          </span>
        </Kv>
        <Kv label="Users">{tenant.userCount}</Kv>
        <Kv label="Hotels">{tenant.hotelCount}</Kv>
        <Kv label="Created">{new Date(tenant.createdAt).toLocaleDateString()}</Kv>
      </div>

      {tenant.hotels.length > 0 && (
        <Section title="Hotels">
          <table style={s.table}>
            <thead><tr>{['Name', 'City', 'Country', 'Created'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {tenant.hotels.map((h) => (
                <tr key={h.id} style={s.tr}>
                  <td style={s.td}>{h.name}</td>
                  <td style={s.td}>{h.city ?? '—'}</td>
                  <td style={s.td}>{h.country ?? '—'}</td>
                  <td style={s.td}>{new Date(h.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Users">
        <table style={s.table}>
          <thead><tr>{['Name', 'Email', 'Role', 'Status'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {tenant.users.map((u) => (
              <tr key={u.id} style={s.tr}>
                <td style={s.td}>{u.firstName} {u.lastName}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}>{u.role?.name ?? '—'}</td>
                <td style={s.td}>
                  <span style={{ color: u.status === 'ACTIVE' ? '#4ade80' : '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem' }}>{title}</h2>
      {children}
    </div>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, padding: '0.75rem 1.25rem' }}>
      <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  h1: { margin: '0.25rem 0 0.1rem', fontSize: '1.5rem', color: '#f1f5f9' },
  slug: { fontSize: '0.8rem', color: '#475569' },
  back: { color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' },
  statsRow: { display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' as const },
  errorBanner: { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '0.6rem 1rem', color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #2d3148', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' as const, fontWeight: 600 },
  tr: { borderBottom: '1px solid #1a1e2e' },
  td: { padding: '0.65rem 0.75rem', color: '#cbd5e1' },
  suspendBtn: { padding: '0.45rem 1rem', background: 'transparent', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem' },
  activateBtn: { padding: '0.45rem 1rem', background: 'transparent', color: '#4ade80', border: '1px solid #14532d', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem' },
};
