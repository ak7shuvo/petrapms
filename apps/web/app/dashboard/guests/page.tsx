'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  fetchHotel,
  fetchGuests,
  createGuest,
  updateGuest,
  deleteGuest,
  type CurrentUser,
  type Hotel,
  type Guest,
} from '../../../lib/api-client';
import { Shell } from '../../../components/shell';

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '',
  address: '', nationality: '', documentNumber: '', notes: '',
};

export default function GuestsPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const limit = 25;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (hotelId: string, p: number, s: string) => {
    const res = await fetchGuests(hotelId, { page: p, limit, search: s || undefined });
    setGuests(res.data);
    setTotal(res.meta.total);
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel()
          .then((h) => { setHotel(h); return load(h.id, page, search); })
          .catch(() => null);
      })
      .catch(() => router.replace('/login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (hotel) load(hotel.id, page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (hotel) load(hotel.id, 1, search);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (g: Guest) => {
    setEditingId(g.id);
    setForm({
      firstName: g.firstName, lastName: g.lastName, email: g.email ?? '',
      phone: g.phone ?? '', address: g.address ?? '', nationality: g.nationality ?? '',
      documentNumber: g.documentNumber ?? '', notes: g.notes ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotel) return;
    setSaving(true);
    setError(null);
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      nationality: form.nationality || undefined,
      documentNumber: form.documentNumber || undefined,
      notes: form.notes || undefined,
    };
    try {
      if (editingId) {
        await updateGuest(hotel.id, editingId, payload);
      } else {
        await createGuest(hotel.id, payload);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load(hotel.id, page, search);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (guestId: string) => {
    if (!hotel || !confirm('Delete this guest?')) return;
    setError(null);
    try {
      await deleteGuest(hotel.id, guestId);
      await load(hotel.id, page, search);
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
        <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>Guests</h1>
        <p style={{ color: '#6b7280' }}>
          Configure your hotel profile first.{' '}
          <a href="/dashboard/hotel" style={{ color: '#1a4d8f' }}>Go to Hotel Settings →</a>
        </p>
      </Shell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Shell user={user}>
      <div style={s.pageHeader}>
        <h1 style={s.h1}>Guests</h1>
        <span style={s.hotelLabel}>{hotel.name}</span>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      <div style={s.toolbar}>
        <form onSubmit={handleSearch} style={s.searchForm}>
          <input
            style={s.input}
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" style={s.searchBtn}>Search</button>
        </form>
        <button style={s.addBtn} onClick={() => (showForm ? setShowForm(false) : openCreate())}>
          {showForm ? 'Cancel' : '+ Add guest'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={s.inlineForm}>
          <input style={s.input} placeholder="First name *" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} maxLength={100} />
          <input style={s.input} placeholder="Last name *" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} maxLength={100} />
          <input style={s.input} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} maxLength={200} />
          <input style={s.input} placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} maxLength={30} />
          <input style={s.input} placeholder="Nationality" value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} maxLength={100} />
          <input style={s.input} placeholder="ID / Passport no." value={form.documentNumber} onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))} maxLength={100} />
          <input style={{ ...s.input, minWidth: 240 }} placeholder="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} maxLength={500} />
          <input style={{ ...s.input, minWidth: 240 }} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={1000} />
          <button type="submit" disabled={saving} style={s.saveBtn}>{saving ? 'Saving…' : editingId ? 'Update' : 'Save'}</button>
        </form>
      )}

      {guests.length === 0 ? (
        <p style={s.empty}>No guests yet. Add one to start taking reservations.</p>
      ) : (
        <>
          <table style={s.table}>
            <thead>
              <tr>
                {['Name', 'Contact', 'Nationality', 'ID', ''].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.id} style={s.tr}>
                  <td style={s.td}><strong>{g.firstName} {g.lastName}</strong></td>
                  <td style={s.td}>
                    {g.email && <span style={s.sub}>{g.email}</span>}
                    {g.phone && <span style={s.sub}>{g.phone}</span>}
                  </td>
                  <td style={s.td}>{g.nationality ?? '—'}</td>
                  <td style={s.td}>{g.documentNumber ?? '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button style={s.editBtn} onClick={() => openEdit(g)}>Edit</button>
                    <button style={s.dangerBtn} onClick={() => handleDelete(g.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={s.pagination}>
            <button style={s.pageBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span style={s.pageInfo}>Page {page} of {totalPages} · {total} guest{total === 1 ? '' : 's'}</span>
            <button style={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </>
      )}
    </Shell>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' },
  h1: { margin: 0, fontSize: '1.5rem', color: '#111827' },
  hotelLabel: { fontSize: '0.85rem', color: '#6b7280' },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.6rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' as const },
  searchForm: { display: 'flex', gap: '0.5rem' },
  searchBtn: { padding: '0.4rem 0.9rem', background: '#374151', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem' },
  addBtn: { padding: '0.4rem 0.9rem', background: '#1a4d8f', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem' },
  inlineForm: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e2e4e8' },
  input: { padding: '0.4rem 0.65rem', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.875rem', minWidth: 140 },
  saveBtn: { padding: '0.4rem 0.9rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.875rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e4e8', color: '#374151', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.65rem 0.75rem', color: '#111827', verticalAlign: 'middle' as const },
  sub: { display: 'block', color: '#6b7280', fontSize: '0.8rem' },
  empty: { color: '#9ca3af', fontSize: '0.875rem', fontStyle: 'italic' },
  editBtn: { padding: '0.3rem 0.65rem', background: 'transparent', color: '#1a4d8f', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', marginRight: '0.4rem' },
  dangerBtn: { padding: '0.3rem 0.65rem', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.25rem' },
  pageBtn: { padding: '0.35rem 0.8rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', fontSize: '0.8rem' },
  pageInfo: { fontSize: '0.8rem', color: '#6b7280' },
};
