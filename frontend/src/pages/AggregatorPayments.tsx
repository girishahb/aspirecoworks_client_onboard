import { useEffect, useState } from 'react';
import { listPayments, type AdminPayment } from '../services/admin';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function StatusBadge({ status }: { status: AdminPayment['status'] }) {
  const map: Record<AdminPayment['status'], { bg: string; color: string }> = {
    PAID: { bg: '#ecfdf5', color: '#065f46' },
    CREATED: { bg: '#eff6ff', color: '#1e40af' },
    FAILED: { bg: '#fef2f2', color: '#991b1b' },
  };
  const c = map[status];
  return (
    <span
      style={{
        padding: '0.2rem 0.55rem',
        borderRadius: 999,
        fontSize: '0.72rem',
        fontWeight: 600,
        background: c.bg,
        color: c.color,
      }}
    >
      {status}
    </span>
  );
}

export default function AggregatorPayments() {
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await listPayments({ limit: 100 });
        if (!cancelled) setPayments(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load payments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500 mt-1">
          Read-only view of payments for clients you have onboarded. Aggregator clients skip the
          internal payment step, so this list is typically empty.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-5 py-3">Company</th>
                <th className="text-left px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Provider</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="text-left px-5 py-3">Paid at</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-900">{p.companyName}</td>
                  <td className="px-5 py-3 text-slate-900">
                    {formatAmount(p.amount, p.currency)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-700">{p.provider}</td>
                  <td className="px-5 py-3 text-slate-700">{formatDate(p.createdAt)}</td>
                  <td className="px-5 py-3 text-slate-700">{formatDate(p.paidAt)}</td>
                </tr>
              ))}
              {!loading && (payments?.length ?? 0) === 0 && !error && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    No payments for your clients.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
