import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  downloadMailNotificationsExcel,
  listMailNotifications,
  type MailNotificationRow,
  type MailNotifyStatusFilter,
} from '../services/admin';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 6);
  return { from: ymd(from), to: ymd(to) };
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN');
}

function receptionistLabel(r: MailNotificationRow['receptionist']): string {
  if (!r) return '—';
  const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
  return name ? `${name} (${r.email})` : r.email;
}

export default function AdminMailNotifications() {
  const initial = useMemo(() => defaultRange(), []);
  const [status, setStatus] = useState<MailNotifyStatusFilter>('success');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<MailNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMailNotifications({ status, from, to });
      setRows(res.rows);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load mail notifications');
    } finally {
      setLoading(false);
    }
  }, [status, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await downloadMailNotificationsExcel({ status, from, to });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-7xl">
      <h1 className="text-2xl font-semibold text-slate-900">Mail notifications</h1>
      <p className="mt-1 text-sm text-slate-600">
        Reception mail emails sent to clients (audit trail). Default: successful sends in the last 7
        days.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MailNotifyStatusFilter)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md bg-sky-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || loading}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Download Excel'}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Receptionist</th>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Email to</th>
              <th className="px-4 py-3 font-semibold">Message ID / Error</th>
              <th className="px-4 py-3 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-slate-500">
                  No mail notifications for this filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === 'success'
                          ? 'rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800'
                          : 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800'
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    <div>{r.receivedAtIst || formatWhen(r.createdAt)}</div>
                    <div className="text-xs text-slate-400">{formatWhen(r.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{receptionistLabel(r.receptionist)}</td>
                  <td className="px-4 py-3">
                    {r.client ? (
                      <Link
                        to={`/admin/companies/${r.client.id}`}
                        className="font-medium text-sky-800 hover:underline"
                      >
                        {r.client.companyName}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.to ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={r.error || r.messageId || ''}>
                    {r.status === 'failed' ? r.error || '—' : r.messageId || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={r.note || ''}>
                    {r.note || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">{rows.length} row(s)</p>
    </div>
  );
}
