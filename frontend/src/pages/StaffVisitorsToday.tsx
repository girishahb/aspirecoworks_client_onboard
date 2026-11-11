import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import { listLocations, type MetaLocation } from '../services/staffOps';
import {
  canManageVisitors,
  checkoutVisitor,
  listVisitorsToday,
  type VisitorListItem,
} from '../services/visitors';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function StaffVisitorsToday() {
  const role = getCurrentUser()?.role;
  const [locations, setLocations] = useState<MetaLocation[]>([]);
  const [locationId, setLocationId] = useState('');
  const [rows, setRows] = useState<VisitorListItem[]>([]);
  const [dateLabel, setDateLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listVisitorsToday({
        locationId: locationId || undefined,
      });
      setRows(res.rows);
      setDateLabel(res.date);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load visitors');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    listLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, [load]);

  async function onCheckout(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await checkoutVisitor(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusyId(null);
    }
  }

  const checkedIn = rows.filter((r) => r.status === 'CHECKED_IN').length;

  if (!canManageVisitors(role)) {
    return <Navigate to="/staff" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/staff" className="text-sm font-medium hover:underline" style={{ color: '#134b7f' }}>
            ← Home
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Today’s visitors</h1>
          <p className="text-sm text-slate-500">
            {dateLabel || 'Today'} · {checkedIn} on site · {rows.length} total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <Link
            to="/staff/visitors/check-in"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#134b7f' }}
          >
            New check-in
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No visitors checked in yet today.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/staff/visitors/${row.id}`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.status === 'CHECKED_IN'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.status === 'CHECKED_IN' ? 'On site' : 'Checked out'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {row.phone}
                    {row.company ? ` · ${row.company}` : ''}
                    {row.purpose ? ` · ${row.purpose}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    In {formatWhen(row.checkInAt)}
                    {row.checkOutAt ? ` · Out ${formatWhen(row.checkOutAt)}` : ''}
                    {row.hostName || row.hostEmail
                      ? ` · Host ${row.hostName || row.hostEmail}`
                      : ' · No host'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/staff/visitors/${row.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Detail
                  </Link>
                  {row.status === 'CHECKED_IN' && (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void onCheckout(row.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      style={{ background: '#134b7f' }}
                    >
                      {busyId === row.id ? '…' : 'Check out'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
