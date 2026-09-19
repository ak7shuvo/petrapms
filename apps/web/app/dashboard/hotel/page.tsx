'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  fetchHotel,
  upsertHotel,
  type CurrentUser,
  type Hotel,
} from '../../../lib/api-client';
import { Shell } from '../../../components/shell';

type FormData = {
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  description: string;
};

export default function HotelSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: '', address: '', city: '', country: '', phone: '', email: '', description: '',
  });

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel().then((h: Hotel) => {
          setForm({
            name: h.name ?? '',
            address: h.address ?? '',
            city: h.city ?? '',
            country: h.country ?? '',
            phone: h.phone ?? '',
            email: h.email ?? '',
            description: h.description ?? '',
          });
        }).catch(() => null); // no hotel yet — form stays empty
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      // Send only non-empty values; treat empty string as null on backend via PartialType
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '')
      );
      await upsertHotel(payload);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <Shell user={user}>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem', color: '#111827' }}>Hotel Settings</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Configure your property profile. This information is scoped to your tenant only.
      </p>

      <form onSubmit={handleSubmit} style={s.form}>
        <Field label="Hotel name *" required>
          <input style={s.input} value={form.name} onChange={set('name')} required maxLength={200} />
        </Field>
        <Field label="Address">
          <input style={s.input} value={form.address} onChange={set('address')} maxLength={500} />
        </Field>
        <div style={s.row}>
          <Field label="City">
            <input style={s.input} value={form.city} onChange={set('city')} maxLength={100} />
          </Field>
          <Field label="Country">
            <input style={s.input} value={form.country} onChange={set('country')} maxLength={100} />
          </Field>
        </div>
        <div style={s.row}>
          <Field label="Phone">
            <input style={s.input} value={form.phone} onChange={set('phone')} maxLength={30} />
          </Field>
          <Field label="Email">
            <input style={s.input} type="email" value={form.email} onChange={set('email')} maxLength={200} />
          </Field>
        </div>
        <Field label="Description">
          <textarea style={{ ...s.input, height: 90, resize: 'vertical' }} value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>

        {error && <p style={s.error}>{error}</p>}
        {success && <p style={s.successMsg}>Hotel settings saved.</p>}

        <button type="submit" disabled={saving} style={s.btn}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </Shell>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  form: { background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8, padding: '1.5rem', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: '1rem' },
  row: { display: 'flex', gap: '1rem' },
  input: { padding: '0.45rem 0.65rem', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  btn: { alignSelf: 'flex-start', padding: '0.5rem 1.25rem', background: '#1a4d8f', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  error: { color: '#dc2626', fontSize: '0.875rem', margin: 0 },
  successMsg: { color: '#16a34a', fontSize: '0.875rem', margin: 0 },
};
