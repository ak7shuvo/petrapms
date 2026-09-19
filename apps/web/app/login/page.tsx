'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '../../lib/api-client';

/**
 * Phase 2 login screen (see /docs/DEVELOPMENT-PHASES.md Phase 2 —
 * "Login screen"). Minimal, functional styling only: visual system is
 * established properly per /docs/UI-UX-DIRECTION.md in a later phase.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.main}>
      <form style={styles.card} onSubmit={onSubmit}>
        <h1 style={styles.title}>PROPETRA</h1>
        <p style={styles.subtitle}>Sign in to your hotel workspace</p>

        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={styles.footer}>
          New hotel? <Link href="/register">Register your tenant</Link>
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
  },
  card: {
    background: '#fff',
    padding: '2rem',
    borderRadius: 8,
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    width: 340,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  title: { margin: 0, fontSize: '1.5rem' },
  subtitle: { margin: 0, color: '#555', fontSize: '0.9rem' },
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
