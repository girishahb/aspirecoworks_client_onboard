import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import {
  canSeeMoney,
  listRecentInvoices,
  listRecentPayments,
} from '../services/staffOps';

type MoneyTab = 'payments' | 'invoices';

function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: any[] }).data;
  }
  return [];
}

export default function StaffMoney() {
  const user = getCurrentUser();
  const allowed = canSeeMoney(user?.role);

  const [tab, setTab] = useState<MoneyTab>('payments');
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const [p, i] = await Promise.all([listRecentPayments(30), listRecentInvoices(30)]);
        setPayments(asList(p));
        setInvoices(asList(i));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load money data');
      } finally {
        setBusy(false);
      }
    })();
  }, [allowed]);

  if (!allowed) {
    return <Navigate to="/staff" replace />;
  }

  const rows = tab === 'payments' ? payments : invoices;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/staff" className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Finance</h1>
      </div>

      <div className="flex gap-2">
        {(['payments', 'invoices'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${
              tab === t
                ? 'bg-[#134b7f] text-white'
                : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((item, idx) => (
          <div
            key={item.id || String(idx)}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {tab === 'payments' ? (
              <>
                <p className="font-semibold text-slate-900">
                  ₹{item.amount} · {item.status}
                </p>
                <p className="text-sm text-slate-500">
                  {item.clientProfile?.companyName || item.companyId || item.id}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-900">
                  {item.invoiceNumber} · ₹{item.totalAmount}
                </p>
                <p className="text-sm text-slate-500">
                  {item.billingName || item.companyId || item.id}
                </p>
              </>
            )}
          </div>
        ))}

        {!busy && rows.length === 0 && !error && (
          <p className="text-sm text-slate-500">No records</p>
        )}
        {busy && <p className="text-sm text-slate-500">Loading…</p>}
      </div>
    </div>
  );
}
