'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  adminListTenants,
  adminUpdateTenantStatus,
  type CurrentUser,
  type TenantListItem,
} from '../../lib/api-client';
import { AdminShell } from '../../components/admin-shell';

export default function AdminTenantsPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    const list = await adminListTenants();
    setTenants(list);
  };

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        if (!u.isPlatformAdmin) { router.replace('/dashboard'); return; }
        setUser(u);
        return load();
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, []);

  const toggleStatus = async (t: TenantListItem) => {
    setToggling(t.id);
    setError(null);
    try {
      const next = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await adminUpdateTenantStatus(t.id, next);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setToggling(null);
    }
  };

  if (loading || !user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#0f1117', color: '#e2e8f0' }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <AdminShell user={user}>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>All Tenants</h1>
        <a href="/admin/onboard" style={s.primaryBtn}>+ Onboard tenant</a>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      <div style={s.statsRow}>
        <Stat label="Total tenants" value={tenants.length} />
        <Stat label="Active" value={tenants.filter((t) => t.status === 'ACTIVE').length} />
        <Stat label="Suspended" value={tenants.filter((t) => t.status === 'SUSPENDED').length} />
      </div>

      {tenants.length === 0 ? (
        <p style={s.empty}>No tenants yet. Onboard the first one.</p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['Name / Slug', 'Users', 'Hotels', 'Status', 'Created', ''].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} style={s.tr}>
                <td style={s.td}>
                  <a href={`/admin/tenants/${t.id}`} style={s.tenantLink}>{t.name}</a>
                  <span style={s.sub}>{t.slug}</span>
                </td>
                <td style={s.td}>{t.userCount}</td>
                <td style={s.td}>{t.hotelCount}</td>
                <td style={s.td}>
                  <span style={{ ...s.statusBadge, ...(t.status === 'ACTIVE' ? s.badgeActive : s.badgeSuspended) }}>
                    {t.status}
                  </span>
                </td>
                <td style={s.td}>{new Date(t.createdAt).toLocaleDateString()}</td>
                <td style={{ ...s.td, textAlign: 'right' }}>
                  <button
                    style={t.status === 'ACTIVE' ? s.suspendBtn : s.activateBtn}
                    disabled={toggling === t.id}
                    onClick={() => toggleStatus(t)}
                  >
                    {toggling === t.id ? '…' : t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, padding: '1rem 1.5rem', minWidth: 120 }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#a78bfa' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  h1: { margin: 0, fontSize: '1.5rem', color: '#f1f5f9' },
  primaryBtn: { padding: '0.45rem 1rem', background: '#7c3aed', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 },
  errorBanner: { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '0.6rem 1rem', color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1rem' },
  statsRow: { display: 'flex', gap: '1rem', marginBottom: '1.5rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #2d3148', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid #1e2130' },
  td: { padding: '0.75rem', color: '#cbd5e1', verticalAlign: 'middle' as const },
  tenantLink: { display: 'block', color: '#a78bfa', textDecoration: 'none', fontWeight: 500 },
  sub: { display: 'block', color: '#475569', fontSize: '0.775rem' },
  statusBadge: { display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600 },
  badgeActive: { background: '#052e16', color: '#4ade80' },
  badgeSuspended: { background: '#450a0a', color: '#f87171' },
  suspendBtn: { padding: '0.3rem 0.7rem', background: 'transparent', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
  activateBtn: { padding: '0.3rem 0.7rem', background: 'transparent', color: '#4ade80', border: '1px solid #14532d', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
  empty: { color: '#475569', fontStyle: 'italic', fontSize: '0.875rem' },
};
