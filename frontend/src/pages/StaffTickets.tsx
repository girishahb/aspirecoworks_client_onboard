import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import {
  canWorkTickets,
  getDeskSummary,
  listDeskTickets,
  type DeskSummary,
  type DeskView,
  type TicketListItem,
} from '../services/tickets';

const VIEWS: { id: DeskView; label: string }[] = [
  { id: 'mine', label: 'Assigned to me' },
  { id: 'queue', label: 'Branch queue' },
  { id: 'closed', label: 'Closed' },
];

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function StaffTickets() {
  const role = getCurrentUser()?.role;
  const [view, setView] = useState<DeskView>('mine');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<DeskSummary | null>(null);
  const [rows, setRows] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [board, list] = await Promise.all([
        getDeskSummary(),
        listDeskTickets({ view, q: search || undefined }),
      ]);
      setSummary(board);
      setRows(list.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tickets');
    } finally {
      setLoading(false);
    }
  }, [view, search]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canWorkTickets(role)) return <Navigate to="/staff" replace />;

  const counts: Record<DeskView, number> = {
    mine: summary?.assignedToMe ?? 0,
    queue: summary?.branchQueue ?? 0,
    closed: summary?.closed ?? 0,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support tickets</h1>
        <p className="text-sm text-slate-500">
          {summary?.homeLocation
            ? summary.homeLocation.name
            : summary?.showingAllBranches
              ? 'All branches'
              : 'Your desk'}
          {summary ? ` · ${summary.inProgress} in progress` : ''}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`rounded-xl border px-3 py-3 text-left ${
              view === item.id ? 'border-[#134b7f] bg-[#e8f1f8]' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="text-lg font-bold text-slate-900">{counts[item.id]}</div>
            <div className="text-xs text-slate-600">{item.label}</div>
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ticket, name, or company"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && rows.length === 0 && <p className="text-sm text-slate-500">No tickets in this list.</p>}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              to={`/staff/tickets/${row.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[#134b7f]/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{row.ticketNumber}</p>
                  <p className="text-sm text-slate-700">
                    {row.customerName} · {row.companyName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {row.issueGroup} · {row.location}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                    row.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                  }`}
                >
                  {row.status === 'IN_PROGRESS' ? 'In progress' : 'Closed'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{formatWhen(row.createdAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
