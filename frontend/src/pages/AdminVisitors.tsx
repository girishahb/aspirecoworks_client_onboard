import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMobileLocations } from '../services/admin';
import {
  downloadVisitorsExcel,
  listAdminVisitors,
  type VisitorListItem,
  type VisitorStatus,
} from '../services/visitors';

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

export default function AdminVisitors() {
  const initial = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [locationId, setLocationId] = useState('');
  const [status, setStatus] = useState<VisitorStatus | 'all'>('all');
  const [locations, setLocations] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [rows, setRows] = useState<VisitorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMobileLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);

  const load = useCallback(
    async (overrides?: { q?: string }) => {
      const nextQ = overrides?.q ?? q;
      setLoading(true);
      setError(null);
      try {
        const res = await listAdminVisitors({
          from,
          to,
          q: nextQ.trim() || undefined,
          locationId: locationId || undefined,
          status,
        });
        setRows(res.rows);
      } catch (err) {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Failed to load visitors');
      } finally {
        setLoading(false);
      }
    },
    [from, to, q, locationId, status],
  );

  useEffect(() => {
    void load();
  }, [from, to, locationId, status]); // eslint-disable-line react-hooks/exhaustive-deps -- search on Apply

  function handleApply() {
    const nextQ = searchInput.trim();
    setQ(nextQ);
    void load({ q: nextQ });
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await downloadVisitorsExcel({
        from,
        to,
        q: (searchInput.trim() || q).trim() || undefined,
        locationId: locationId || undefined,
        status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visitors</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search reception check-ins and export the day log. Aadhaar last-4 is masked in lists.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as VisitorStatus | 'all')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="CHECKED_IN">Checked in</option>
            <option value="CHECKED_OUT">Checked out</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Search</label>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApply();
            }}
            placeholder="Name, phone, company, host…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#134b7f' }}
          >
            Apply
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Check-in</th>
              <th className="px-4 py-3 font-semibold">Visitor</th>
              <th className="px-4 py-3 font-semibold">Purpose</th>
              <th className="px-4 py-3 font-semibold">Host</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Aadhaar</th>
              <th className="px-4 py-3 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-slate-500">
                  No visits in this range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatWhen(row.checkInAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="text-xs text-slate-500">
                      {row.phone}
                      {row.company ? ` · ${row.company}` : ''}
                    </div>
                    <Link
                      to={`/staff/visitors/${row.id}`}
                      className="text-xs font-medium hover:underline"
                      style={{ color: '#134b7f' }}
                    >
                      Open in staff
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[14rem] truncate">{row.purpose}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.hostName || row.hostEmail || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.status === 'CHECKED_IN'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.status === 'CHECKED_IN' ? 'On site' : 'Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.aadhaarLast4Masked || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.location?.name || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
