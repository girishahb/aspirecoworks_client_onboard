import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  downloadTicketExport,
  getAdminTicketSummary,
  listAdminTickets,
  type TicketListItem,
} from '../services/tickets';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
}

export default function AdminTickets() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAdminTicketSummary>> | null>(null);
  const [rows, setRows] = useState<TicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [issueGroupId, setIssueGroupId] = useState('');
  const [status, setStatus] = useState('all');
  const [unassigned, setUnassigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [board, list] = await Promise.all([
        getAdminTicketSummary(),
        listAdminTickets({
          q: search || undefined,
          locationId: locationId || undefined,
          issueGroupId: issueGroupId || undefined,
          status: status === 'all' ? undefined : status,
          unassigned: unassigned ? '1' : undefined,
          page,
        }),
      ]);
      setSummary(board);
      setRows(list.rows);
      setTotal(list.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tickets');
    } finally {
      setLoading(false);
    }
  }, [search, locationId, issueGroupId, status, unassigned, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = [
    ['Total', summary?.total],
    ['In progress', summary?.inProgress],
    ['Closed', summary?.closed],
    ['Created today', summary?.createdToday],
    ['Closed today', summary?.closedToday],
    ['Unassigned', summary?.unassigned],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support tickets</h1>
          <p className="text-sm text-slate-500">Every branch. Reception works the same tickets from Staff Ops.</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          onClick={() =>
            void downloadTicketExport({
              q: search || undefined,
              locationId: locationId || undefined,
              issueGroupId: issueGroupId || undefined,
              status: status === 'all' ? undefined : status,
              unassigned: unassigned ? '1' : undefined,
            })
          }
        >
          Export Excel
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="text-xl font-semibold text-slate-900">{value ?? '—'}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {summary && summary.unconfiguredGroups.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No email recipients yet for: {summary.unconfiguredGroups.join(', ')}. Add them in Ticket setup.
        </p>
      )}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ticket, name, or company"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <select
          value={locationId}
          onChange={(e) => {
            setPage(1);
            setLocationId(e.target.value);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All locations</option>
          {summary?.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <select
          value={issueGroupId}
          onChange={(e) => {
            setPage(1);
            setIssueGroupId(e.target.value);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All issues</option>
          {summary?.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Any status</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="CLOSED">Closed</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={unassigned}
            onChange={(e) => {
              setPage(1);
              setUnassigned(e.target.checked);
            }}
          />
          Unassigned
        </label>
        <button type="submit" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900">
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm text-slate-800">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {['Ticket', 'Created', 'Customer', 'Company', 'Location', 'Issue', 'Assigned', 'Status'].map((heading) => (
                <th key={heading} className="px-3 py-2 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link to={`/admin/tickets/${row.id}`} className="font-medium hover:underline" style={{ color: '#134b7f' }}>
                    {row.ticketNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                <td className="px-3 py-2">{row.customerName}</td>
                <td className="px-3 py-2">{row.companyName}</td>
                <td className="px-3 py-2">{row.location}</td>
                <td className="px-3 py-2">{row.issueGroup}</td>
                <td className="px-3 py-2">{row.assignee || 'Queue'}</td>
                <td className="px-3 py-2">
                  <span className={row.status === 'IN_PROGRESS' ? 'text-blue-700' : 'text-green-700'}>
                    {row.status === 'IN_PROGRESS' ? 'In progress' : 'Closed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{total} tickets</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page * 25 >= total}
            className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
