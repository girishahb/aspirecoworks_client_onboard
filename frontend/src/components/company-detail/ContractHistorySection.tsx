import { useEffect, useState } from 'react';
import { getContractHistory, type ContractHistoryRow } from '../../services/admin';
import { formatCompanyDate } from './formatting';

type Props = {
  companyId: string;
  /** Bump to reload after a profile save that may have archived a term. */
  refreshKey?: string | number;
};

export default function ContractHistorySection({ companyId, refreshKey }: Props) {
  const [rows, setRows] = useState<ContractHistoryRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const data = await getContractHistory(companyId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : 'Could not load history');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, refreshKey]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mt-0 text-lg font-semibold text-slate-900">Agreement history</h2>
      <p className="mt-1 text-sm text-slate-600">
        Previous start/end dates and booking IDs when a term was renewed or corrected. Current term is
        on the profile above.
      </p>

      {busy ? <p className="mt-3 text-sm text-slate-500">Loading…</p> : null}
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {!busy && !error && rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No previous terms yet.</p>
      ) : null}

      {!busy && rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-semibold">Changed</th>
                <th className="py-2 pr-4 font-semibold">Start</th>
                <th className="py-2 pr-4 font-semibold">End</th>
                <th className="py-2 pr-4 font-semibold">Booking ID</th>
                <th className="py-2 pr-4 font-semibold">By</th>
                <th className="py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const by = row.changedBy
                  ? [row.changedBy.firstName, row.changedBy.lastName].filter(Boolean).join(' ') ||
                    row.changedBy.email
                  : '—';
                return (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 text-slate-800 whitespace-nowrap">
                      {new Date(row.changedAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-800">
                      {formatCompanyDate(row.contractStartDate)}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-800">
                      {formatCompanyDate(row.contractEndDate)}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">
                      {row.externalBookingId || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">{by}</td>
                    <td className="py-2.5 text-slate-600">{row.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
