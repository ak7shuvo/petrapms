'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerTenant } from '../../lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    tenantName: '',
    tenantSlug: '',
    adminEmail: '',
    adminPassword: '',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerTenant(form);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.main}>
      <form style={styles.card} onSubmit={onSubmit}>
        <h1 style={styles.title}>Register your hotel</h1>
        <p style={styles.subtitle}>
          Creates a new, isolated PROPETRA workspace and its first administrator account.
        </p>

        <label style={styles.label}>
          Hotel / tenant name
          <input style={styles.input} required value={form.tenantName} onChange={update('tenantName')} />
        </label>

        <label style={styles.label}>
          Workspace slug (lowercase, hyphens only)
          <input style={styles.input} required pattern="[a-z0-9-]+" value={form.tenantSlug} onChange={update('tenantSlug')} />
        </label>

        <label style={styles.label}>
          Admin first name
          <input style={styles.input} required value={form.firstName} onChange={update('firstName')} />
        </label>

        <label style={styles.label}>
          Admin last name
          <input style={styles.input} required value={form.lastName} onChange={update('lastName')} />
        </label>

        <label style={styles.label}>
          Admin email
          <input style={styles.input} type="email" required value={form.adminEmail} onChange={update('adminEmail')} />
        </label>

        <label style={styles.label}>
          Admin password (min 10 characters)
          <input
            style={styles.input}
            type="password"
            required
            minLength={10}
            value={form.adminPassword}
            onChange={update('adminPassword')}
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Creating workspace…' : 'Create workspace'}
        </button>

        <p style={styles.footer}>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, sans-serif',
    background: '#f4f5f7',
    padding: '2rem 0',
  },
  card: {
    background: '#fff',
    padding: '2rem',
    borderRadius: 8,
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    width: 380,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  title: { margin: 0, fontSize: '1.4rem' },
  subtitle: { margin: 0, color: '#555', fontSize: '0.85rem' },
  label: { display: 'flex', flexDirection: 'column', fontSize: '0.85rem', gap: 4 },
  input: { padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc', fontSize: '1rem' },
  button: {
    marginTop: '0.5rem',
    padding: '0.6rem',
    borderRadius: 4,
    border: 'none',
    background: '#1a4d8f',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  error: { color: '#c0392b', fontSize: '0.85rem', margin: 0 },
  footer: { fontSize: '0.85rem', textAlign: 'center', margin: 0, color: '#555' },
};
