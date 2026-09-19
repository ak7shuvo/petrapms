'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  adminProvisionTenant,
  type CurrentUser,
} from '../../../lib/api-client';
import { AdminShell } from '../../../components/admin-shell';

type Form = {
  tenantName: string; tenantSlug: string;
  adminEmail: string; adminPassword: string;
  firstName: string; lastName: string;
};

const empty: Form = { tenantName: '', tenantSlug: '', adminEmail: '', adminPassword: '', firstName: '', lastName: '' };

export default function OnboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => { if (!u.isPlatformAdmin) { router.replace('/dashboard'); return; } setUser(u); })
      .catch(() => router.replace('/login'));
  }, []);

  // Auto-generate slug from name
  const handleNameChange = (v: string) => {
    setForm((f) => ({
      ...f,
      tenantName: v,
      tenantSlug: f.tenantSlug === '' || f.tenantSlug === slugify(f.tenantName)
        ? slugify(v) : f.tenantSlug,
    }));
  };

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await adminProvisionTenant(form);
      setSuccess(`Tenant "${result.name}" created. Admin: ${form.adminEmail}`);
      setForm(empty);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#0f1117', color: '#e2e8f0' }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <AdminShell user={user}>
      <h1 style={s.h1}>Onboard New Tenant</h1>
      <p style={s.sub}>Provision a hotel client. This creates their tenant workspace and the first Hotel Administrator account.</p>

      <form onSubmit={handleSubmit} style={s.form}>
        <Field label="Hotel / company name *">
          <input style={s.input} value={form.tenantName} onChange={(e) => handleNameChange(e.target.value)} required maxLength={200} />
        </Field>
        <Field label="Slug (URL identifier) *">
          <input style={s.input} value={form.tenantSlug} onChange={set('tenantSlug')} required maxLength={60} pattern="[a-z0-9-]+" title="Lowercase letters, numbers, hyphens only" />
          <span style={s.hint}>Lowercase letters, numbers, hyphens. Cannot be changed later.</span>
        </Field>

        <hr style={s.divider} />
        <p style={s.sectionLabel}>Hotel Administrator Account</p>

        <div style={s.row}>
          <Field label="First name *">
            <input style={s.input} value={form.firstName} onChange={set('firstName')} required maxLength={100} />
          </Field>
          <Field label="Last name *">
            <input style={s.input} value={form.lastName} onChange={set('lastName')} required maxLength={100} />
          </Field>
        </div>
        <Field label="Email *">
          <input style={s.input} type="email" value={form.adminEmail} onChange={set('adminEmail')} required maxLength={200} />
        </Field>
        <Field label="Temporary password *">
          <input style={s.input} type="password" value={form.adminPassword} onChange={set('adminPassword')} required minLength={8} maxLength={100} />
          <span style={s.hint}>Min 8 characters. The admin should change this on first login.</span>
        </Field>

        {error && <p style={s.error}>{error}</p>}
        {success && <p style={s.successMsg}>✓ {success}</p>}

        <div style={s.actions}>
          <button type="submit" disabled={saving} style={s.submitBtn}>
            {saving ? 'Creating…' : 'Create tenant'}
          </button>
          <a href="/admin" style={s.cancelLink}>Cancel</a>
        </div>
      </form>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>{label}</label>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  h1: { margin: '0 0 0.25rem', fontSize: '1.5rem', color: '#f1f5f9' },
  sub: { color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' },
  form: { background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, padding: '1.75rem', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '1rem' },
  row: { display: 'flex', gap: '1rem' },
  input: { padding: '0.45rem 0.7rem', borderRadius: 5, border: '1px solid #374151', background: '#0f1117', color: '#e2e8f0', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' as const },
  hint: { fontSize: '0.75rem', color: '#475569' },
  divider: { border: 'none', borderTop: '1px solid #2d3148', margin: '0.25rem 0' },
  sectionLabel: { margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  actions: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' },
  submitBtn: { padding: '0.5rem 1.25rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  cancelLink: { color: '#64748b', textDecoration: 'none', fontSize: '0.875rem' },
  error: { color: '#f87171', fontSize: '0.875rem', margin: 0 },
  successMsg: { color: '#4ade80', fontSize: '0.875rem', margin: 0 },
};
