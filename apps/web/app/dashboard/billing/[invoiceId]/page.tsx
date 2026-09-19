'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  fetchCurrentUser, fetchHotel, fetchInvoice,
  issueInvoice, voidInvoice, recordPayment, voidPayment,
  type CurrentUser, type Hotel, type InvoiceDetail,
  type PaymentMethod,
} from '../../../../lib/api-client';
import { Shell } from '../../../../components/shell';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#6b7280', ISSUED: '#2563eb', PARTIALLY_PAID: '#d97706', PAID: '#16a34a', VOID: '#dc2626',
};
const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'];

export default function InvoiceDetailPage() {
  const router = useRouter();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH' as PaymentMethod, reference: '' });
  const [paying, setPaying] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async (hId: string) => {
    const data = await fetchInvoice(hId, invoiceId);
    setInv(data);
  }, [invoiceId]);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        return fetchHotel().then((h) => { setHotel(h); return load(h.id); });
      })
      .catch(() => router.replace('/login'));
  }, [router, load]);

  const act = async (fn: () => Promise<InvoiceDetail>) => {
    setActing(true); setError(null);
    try { setInv(await fn()); } catch (e: any) { setError(e.message); } finally { setActing(false); }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotel || !inv) return;
    setPaying(true); setError(null);
    try {
      const res = await recordPayment(hotel.id, inv.id, {
        amount: parseFloat(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || undefined,
      });
      setInv(res.invoice);
      setPayForm({ amount: '', method: 'CASH', reference: '' });
    } catch (e: any) { setError(e.message); } finally { setPaying(false); }
  };

  const handleVoidPayment = async (paymentId: string) => {
    if (!hotel || !inv || !confirm('Void this payment?')) return;
    setError(null);
    try {
      const res = await voidPayment(hotel.id, inv.id, paymentId);
      setInv(res.invoice);
    } catch (e: any) { setError(e.message); }
  };

  if (!user || !inv) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}><p>Loading…</p></main>;
  }

  const canPay = inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID';
  const canIssue = inv.status === 'DRAFT';
  const canVoid = inv.status !== 'VOID';

  return (
    <Shell user={user!}>
      <div style={s.pageHeader}>
        <div>
          <a href="/dashboard/billing" style={s.back}>← All invoices</a>
          <h1 style={s.h1}>Invoice</h1>
          {inv.stay && (
            <p style={s.meta}>
              {inv.stay.guest.firstName} {inv.stay.guest.lastName} · Room {inv.stay.room.number} · {inv.stay.room.roomType.name}
            </p>
          )}
        </div>
        <span style={{ ...s.statusBadge, color: STATUS_COLOR[inv.status] }}>{inv.status.replace('_', ' ')}</span>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {/* Summary */}
      <div style={s.summaryRow}>
        <Kv label="Total">${inv.totalAmount.toFixed(2)}</Kv>
        <Kv label="Paid">${inv.paidAmount.toFixed(2)}</Kv>
        <Kv label="Balance due"><strong style={{ color: inv.balanceDue > 0 ? '#dc2626' : '#16a34a' }}>${inv.balanceDue.toFixed(2)}</strong></Kv>
        {inv.issuedAt && <Kv label="Issued">{new Date(inv.issuedAt).toLocaleDateString()}</Kv>}
        {inv.dueDate && <Kv label="Due">{new Date(inv.dueDate).toLocaleDateString()}</Kv>}
      </div>

      {/* Actions */}
      <div style={s.actions}>
        {canIssue && (
          <button style={s.primaryBtn} disabled={acting} onClick={() => act(() => issueInvoice(hotel!.id, inv.id))}>
            {acting ? '…' : 'Issue invoice'}
          </button>
        )}
        {canVoid && (
          <button style={s.dangerBtn} disabled={acting} onClick={() => { if (confirm('Void this invoice? This cannot be undone.')) act(() => voidInvoice(hotel!.id, inv.id)); }}>
            Void
          </button>
        )}
      </div>

      {/* Line items */}
      <Section title="Line Items">
        <table style={s.table}>
          <thead><tr>{['Description', 'Qty', 'Unit price', 'Amount'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {inv.lineItems.map((li) => (
              <tr key={li.id} style={s.tr}>
                <td style={s.td}>{li.description}</td>
                <td style={s.td}>{li.quantity}</td>
                <td style={s.td}>${li.unitPrice.toFixed(2)}</td>
                <td style={s.td}><strong>${li.amount.toFixed(2)}</strong></td>
              </tr>
            ))}
            <tr style={{ background: '#f9fafb' }}>
              <td colSpan={3} style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>Total</td>
              <td style={{ ...s.td, fontWeight: 700 }}>${inv.totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Payments */}
      <Section title="Payments">
        {inv.payments.filter((p) => !p.voidedAt).length === 0 ? (
          <p style={s.empty}>No payments recorded.</p>
        ) : (
          <table style={s.table}>
            <thead><tr>{['Amount', 'Method', 'Reference', 'Date', ''].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {inv.payments.map((p) => (
                <tr key={p.id} style={{ ...s.tr, opacity: p.voidedAt ? 0.45 : 1 }}>
                  <td style={s.td}>${p.amount.toFixed(2)}</td>
                  <td style={s.td}>{p.method.replace('_', ' ')}</td>
                  <td style={s.td}>{p.reference ?? '—'}</td>
                  <td style={s.td}>{new Date(p.paidAt).toLocaleDateString()}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    {!p.voidedAt && canVoid && (
                      <button style={s.voidBtn} onClick={() => handleVoidPayment(p.id)}>Void</button>
                    )}
                    {p.voidedAt && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>VOIDED</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canPay && (
          <form onSubmit={handlePay} style={s.payForm}>
            <input
              style={s.input} type="number" step="0.01" min="0.01" required
              placeholder={`Amount (due: $${inv.balanceDue.toFixed(2)})`}
              value={payForm.amount}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <select style={s.input} value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}>
              {METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
            <input
              style={s.input} placeholder="Reference (optional)"
              value={payForm.reference}
              onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
            />
            <button type="submit" disabled={paying} style={s.primaryBtn}>{paying ? 'Recording…' : 'Record payment'}</button>
          </form>
        )}
      </Section>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>{title}</h2>
      {children}
    </div>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8, padding: '0.75rem 1.25rem' }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#111827', fontWeight: 500 }}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  h1: { margin: '0.25rem 0 0', fontSize: '1.5rem', color: '#111827' },
  meta: { margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' },
  back: { color: '#6b7280', textDecoration: 'none', fontSize: '0.85rem' },
  statusBadge: { fontWeight: 700, fontSize: '0.875rem', marginTop: '0.5rem' },
  summaryRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap' as const, marginBottom: '1rem' },
  actions: { display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' },
  errorBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.6rem 1rem', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem', background: '#fff', border: '1px solid #e2e4e8', borderRadius: 8 },
  th: { textAlign: 'left' as const, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e4e8', color: '#374151', fontSize: '0.75rem', textTransform: 'uppercase' as const, fontWeight: 700 },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.65rem 0.75rem', color: '#111827' },
  empty: { color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' },
  payForm: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginTop: '1rem', padding: '1rem', background: '#f9fafb', border: '1px solid #e2e4e8', borderRadius: 8 },
  input: { padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.875rem', minWidth: 160 },
  primaryBtn: { padding: '0.45rem 1rem', background: '#1a4d8f', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 },
  dangerBtn: { padding: '0.45rem 1rem', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 5, cursor: 'pointer', fontSize: '0.875rem' },
  voidBtn: { padding: '0.25rem 0.6rem', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', fontSize: '0.775rem' },
};
