import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Badge from '../components/Badge';
import {
  getMobileLocations,
  listCompaniesPage,
  type AdminCompany,
} from '../services/admin';
import {
  deskClientStatus,
  type DeskClientStatus,
} from '../utils/agreementStatus';

const PAGE_SIZE = 10;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const STAGE_LABELS: Record<string, string> = {
  ADMIN_CREATED: 'Admin created',
  PENDING_DOCUMENTS: 'Pending documents',
  DOCUMENTS_SUBMITTED: 'Documents submitted',
  UNDER_REVIEW: 'Under review',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  KYC_IN_PROGRESS: 'KYC in progress',
  KYC_REVIEW: 'KYC review',
  AGREEMENT_DRAFT_SHARED: 'Agreement draft shared',
  SIGNED_AGREEMENT_RECEIVED: 'Signed received',
  FINAL_AGREEMENT_SHARED: 'Final shared',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
};

function stageLabel(stage: string | null | undefined): string {
  return stage ? (STAGE_LABELS[stage] ?? stage) : '—';
}

function statusLabel(status: DeskClientStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'inactive':
      return 'Inactive';
    case 'pending':
    default:
      return 'Not started';
  }
}

function CellText({
  value,
  className = '',
  maxWidth = 'max-w-[10rem]',
}: {
  value: string;
  className?: string;
  maxWidth?: string;
}) {
  return (
    <span className={`block truncate ${maxWidth} ${className}`} title={value}>
      {value}
    </span>
  );
}

type ChannelFilter = 'ALL' | 'DIRECT' | 'AGGREGATOR';
type StatusFilter = 'ALL' | DeskClientStatus;

function pageWindow(current: number, totalPages: number, span = 5): number[] {
  if (totalPages <= span) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(span / 2);
  let start = Math.max(1, current - half);
  let end = start + span - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - span + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; code?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    pending: 0,
    expired: 0,
    aggregator: 0,
  });

  useEffect(() => {
    getMobileLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCompaniesPage({
        page,
        pageSize: PAGE_SIZE,
        q: search || undefined,
        locationId: locationFilter === 'ALL' ? undefined : locationFilter,
        clientChannel: channelFilter === 'ALL' ? undefined : channelFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setCompanies(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setCounts(res.counts);
      if (page > res.totalPages && res.totalPages >= 1) {
        setPage(res.totalPages);
      }
    } catch (err) {
      setCompanies([]);
      setTotal(0);
      setTotalPages(1);
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, search, channelFilter, statusFilter, locationFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = useMemo(() => pageWindow(page, totalPages), [page, totalPages]);
  const fromRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(page * PAGE_SIZE, total);

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function goToPage(next: number) {
    const clamped = Math.max(1, Math.min(totalPages, next));
    setPage(clamped);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete view of onboarded clients, their contacts, contract dates, and status.
          </p>
        </div>
        <Link
          to="/admin/companies/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ background: '#134b7f' }}
        >
          + New Client
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Active" value={counts.active} tone="emerald" />
        <StatCard label="Not started" value={counts.pending} tone="amber" />
        <StatCard label="Expired" value={counts.expired} tone="red" />
        <StatCard label="Aggregator" value={counts.aggregator} tone="slate" />
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search customer</label>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applySearch();
                }
              }}
              placeholder="Company name, contact, email, phone, location…"
              className="form-input"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={applySearch}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: '#134b7f' }}
          >
            Search
          </button>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
            <select
              value={locationFilter}
              onChange={(e) => {
                setPage(1);
                setLocationFilter(e.target.value);
              }}
              className="form-input min-w-[160px]"
            >
              <option value="ALL">All locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.code ? ` (${loc.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
            <select
              value={channelFilter}
              onChange={(e) => {
                setPage(1);
                setChannelFilter(e.target.value as ChannelFilter);
              }}
              className="form-input"
            >
              <option value="ALL">All</option>
              <option value="DIRECT">Direct</option>
              <option value="AGGREGATOR">Aggregator</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as StatusFilter);
              }}
              className="form-input"
            >
              <option value="ALL">All</option>
              <option value="active">Active</option>
              <option value="pending">Not started</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">All Customers</p>
          <span className="text-xs text-slate-400">
            {loading
              ? 'Loading…'
              : total === 0
                ? '0 customers'
                : `Showing ${fromRow}–${toRow} of ${total}`}
          </span>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-sm text-slate-500">Loading customers…</div>
        ) : companies.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-slate-500 text-sm">
              {counts.total === 0
                ? 'No customers yet. Create your first client to get started.'
                : 'No customers match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table text-sm table-fixed w-full min-w-[960px]">
                <colgroup>
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>Channel</th>
                    <th>Aggregator</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const status = deskClientStatus(company);
                    const channel = company.clientChannel ?? 'DIRECT';
                    return (
                      <tr
                        key={company.id}
                        onClick={() => navigate(`/admin/companies/${company.id}`)}
                        className="cursor-pointer"
                      >
                        <td className="font-medium text-slate-900">
                          <CellText value={company.companyName} maxWidth="max-w-[12rem]" />
                        </td>
                        <td className="text-slate-700">
                          <CellText value={company.contactEmail} maxWidth="max-w-[12rem]" />
                        </td>
                        <td className="text-slate-700 whitespace-nowrap">
                          {company.contactPhone ?? '—'}
                        </td>
                        <td className="text-slate-700">
                          <CellText value={company.location?.name ?? '—'} maxWidth="max-w-[8rem]" />
                        </td>
                        <td>
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border whitespace-nowrap"
                            style={
                              channel === 'AGGREGATOR'
                                ? { background: '#eef2ff', color: '#3730a3', borderColor: '#c7d2fe' }
                                : { background: '#f1f5f9', color: '#334155', borderColor: '#e2e8f0' }
                            }
                          >
                            {channel === 'AGGREGATOR' ? 'Aggregator' : 'Direct'}
                          </span>
                        </td>
                        <td className="text-slate-700">
                          <CellText value={company.aggregatorName ?? '—'} maxWidth="max-w-[8rem]" />
                        </td>
                        <td className="text-slate-700">
                          <CellText
                            value={stageLabel(company.onboardingStage)}
                            maxWidth="max-w-[8rem]"
                          />
                        </td>
                        <td>
                          <Badge variant={status}>{statusLabel(status)}</Badge>
                        </td>
                        <td className="text-slate-700 whitespace-nowrap text-xs">
                          {formatDate(company.contractStartDate)}
                        </td>
                        <td className="text-slate-700 whitespace-nowrap text-xs">
                          {formatDate(company.contractEndDate)}
                        </td>
                        <td className="text-slate-500 whitespace-nowrap text-xs">
                          {formatDate(company.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => goToPage(page - 1)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  {pages[0] > 1 && (
                    <>
                      <PageBtn n={1} current={page} onClick={goToPage} disabled={loading} />
                      {pages[0] > 2 && <span className="px-1 text-slate-400 text-xs">…</span>}
                    </>
                  )}
                  {pages.map((n) => (
                    <PageBtn key={n} n={n} current={page} onClick={goToPage} disabled={loading} />
                  ))}
                  {pages[pages.length - 1] < totalPages && (
                    <>
                      {pages[pages.length - 1] < totalPages - 1 && (
                        <span className="px-1 text-slate-400 text-xs">…</span>
                      )}
                      <PageBtn
                        n={totalPages}
                        current={page}
                        onClick={goToPage}
                        disabled={loading}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => goToPage(page + 1)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </p>
              </div>

              <label className="flex items-center gap-3 text-xs text-slate-600">
                <span className="shrink-0 font-medium">Jump</span>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, totalPages)}
                  value={page}
                  disabled={loading || totalPages <= 1}
                  onChange={(e) => goToPage(Number(e.target.value))}
                  className="w-full accent-sky-800"
                />
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, totalPages)}
                  value={page}
                  disabled={loading || totalPages <= 1}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) goToPage(n);
                  }}
                  className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center"
                />
              </label>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PageBtn({
  n,
  current,
  onClick,
  disabled,
}: {
  n: number;
  current: number;
  onClick: (n: number) => void;
  disabled?: boolean;
}) {
  const active = n === current;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(n)}
      className={`min-w-[2rem] rounded-md px-2 py-1.5 text-xs font-medium border disabled:opacity-40 ${
        active
          ? 'bg-sky-800 text-white border-sky-800'
          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
      }`}
    >
      {n}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone = 'primary',
}: {
  label: string;
  value: number;
  tone?: 'primary' | 'emerald' | 'amber' | 'red' | 'slate';
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    primary: { bg: 'rgba(19,75,127,0.08)', fg: '#134b7f' },
    emerald: { bg: '#ecfdf5', fg: '#047857' },
    amber: { bg: '#fffbeb', fg: '#b45309' },
    red: { bg: '#fef2f2', fg: '#b91c1c' },
    slate: { bg: '#f1f5f9', fg: '#334155' },
  };
  const c = palette[tone];
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-lg font-bold"
          style={{ background: c.bg, color: c.fg }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
