import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Badge from '../components/Badge';
import { listCompanies, type AdminCompany } from '../services/admin';

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

type ClientStatus = 'active' | 'inactive' | 'pending' | 'expired';

function clientStatus(company: AdminCompany): ClientStatus {
  if (company.renewalStatus === 'EXPIRED') return 'expired';
  if (company.renewalStatus === 'ACTIVE') return 'active';
  if (company.onboardingStage === 'ACTIVE' || company.onboardingStage === 'COMPLETED') return 'active';
  if (company.onboardingStage === 'REJECTED') return 'inactive';
  return 'pending';
}

function statusLabel(status: ClientStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'inactive':
      return 'Inactive';
    case 'pending':
    default:
      return 'Onboarding';
  }
}

type ChannelFilter = 'ALL' | 'DIRECT' | 'AGGREGATOR';
type StatusFilter = 'ALL' | ClientStatus;

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCompanies()
      .then((data) => {
        if (!cancelled) setCompanies(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load customers');
          setCompanies([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (channelFilter !== 'ALL' && (c.clientChannel ?? 'DIRECT') !== channelFilter) return false;
      if (statusFilter !== 'ALL' && clientStatus(c) !== statusFilter) return false;
      if (!q) return true;
      return (
        c.companyName.toLowerCase().includes(q) ||
        c.contactEmail.toLowerCase().includes(q) ||
        (c.contactPhone ?? '').toLowerCase().includes(q) ||
        (c.aggregatorName ?? '').toLowerCase().includes(q)
      );
    });
  }, [companies, search, channelFilter, statusFilter]);

  const counts = useMemo(() => {
    const total = companies.length;
    let active = 0;
    let onboarding = 0;
    let expired = 0;
    let aggregator = 0;
    for (const c of companies) {
      const s = clientStatus(c);
      if (s === 'active') active += 1;
      else if (s === 'pending') onboarding += 1;
      else if (s === 'expired') expired += 1;
      if ((c.clientChannel ?? 'DIRECT') === 'AGGREGATOR') aggregator += 1;
    }
    return { total, active, onboarding, expired, aggregator };
  }, [companies]);

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
        <StatCard label="Onboarding" value={counts.onboarding} tone="amber" />
        <StatCard label="Expired" value={counts.expired} tone="red" />
        <StatCard label="Aggregator" value={counts.aggregator} tone="slate" />
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Company, email, phone, aggregator…"
              className="form-input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
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
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="form-input"
            >
              <option value="ALL">All</option>
              <option value="active">Active</option>
              <option value="pending">Onboarding</option>
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
            {loading ? 'Loading…' : `${filtered.length} of ${companies.length}`}
          </span>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-sm text-slate-500">Loading customers…</div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-slate-500 text-sm">
              {companies.length === 0
                ? 'No customers yet. Create your first client to get started.'
                : 'No customers match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Contact email</th>
                    <th>Contact phone</th>
                    <th>Channel</th>
                    <th>Aggregator</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Contract start</th>
                    <th>Contract end</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((company) => {
                    const status = clientStatus(company);
                    const channel = company.clientChannel ?? 'DIRECT';
                    return (
                      <tr
                        key={company.id}
                        onClick={() => navigate(`/admin/companies/${company.id}`)}
                        className="cursor-pointer"
                      >
                        <td className="font-medium text-slate-900">{company.companyName}</td>
                        <td className="text-slate-700">{company.contactEmail}</td>
                        <td className="text-slate-700">{company.contactPhone ?? '—'}</td>
                        <td>
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border"
                            style={
                              channel === 'AGGREGATOR'
                                ? { background: '#eef2ff', color: '#3730a3', borderColor: '#c7d2fe' }
                                : { background: '#f1f5f9', color: '#334155', borderColor: '#e2e8f0' }
                            }
                          >
                            {channel === 'AGGREGATOR' ? 'Aggregator' : 'Direct'}
                          </span>
                        </td>
                        <td className="text-slate-700">{company.aggregatorName ?? '—'}</td>
                        <td className="text-slate-700">{stageLabel(company.onboardingStage)}</td>
                        <td>
                          <Badge variant={status}>{statusLabel(status)}</Badge>
                        </td>
                        <td className="text-slate-700">{formatDate(company.contractStartDate)}</td>
                        <td className="text-slate-700">{formatDate(company.contractEndDate)}</td>
                        <td className="text-slate-500">{formatDate(company.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
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
