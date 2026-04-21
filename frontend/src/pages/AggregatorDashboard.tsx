import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listCompanies, type AdminCompany } from '../services/admin';
import { getMyInvoiceProfile } from '../services/aggregatorProfile';
import { getCurrentUser } from '../services/auth';

const ACTIVE_STAGES = new Set(['ACTIVE', 'COMPLETED']);
const TERMINAL_STAGES = new Set(['ACTIVE', 'COMPLETED', 'REJECTED']);

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

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = then - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function StageBadge({ stage }: { stage?: string }) {
  const label = (stage ?? 'PENDING').replace(/_/g, ' ');
  const isActive = stage === 'ACTIVE' || stage === 'COMPLETED';
  const isRejected = stage === 'REJECTED';
  const bg = isActive ? '#ecfdf5' : isRejected ? '#fef2f2' : '#eff6ff';
  const color = isActive ? '#065f46' : isRejected ? '#991b1b' : '#1e40af';
  return (
    <span
      style={{
        padding: '0.2rem 0.55rem',
        borderRadius: 999,
        fontSize: '0.72rem',
        fontWeight: 600,
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  );
}

export default function AggregatorDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [companies, setCompanies] = useState<AdminCompany[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceProfileMissing, setInvoiceProfileMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [data, profile] = await Promise.all([
          listCompanies(),
          getMyInvoiceProfile().catch(() => null),
        ]);
        if (!cancelled) {
          setCompanies(data);
          setInvoiceProfileMissing(!profile);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load clients');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(() => {
    const list = companies ?? [];
    const total = list.length;
    const active = list.filter((c) => ACTIVE_STAGES.has(String(c.onboardingStage ?? ''))).length;
    const onboarding = list.filter((c) => !TERMINAL_STAGES.has(String(c.onboardingStage ?? ''))).length;
    const expiring = list.filter((c) => {
      const d = daysUntil(c.contractEndDate ?? undefined);
      return d !== null && d >= 0 && d <= 30;
    }).length;
    return { total, active, onboarding, expiring };
  }, [companies]);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Partner: <span className="font-medium text-slate-700">{user?.aggregatorName || '—'}</span>
          </p>
        </div>
        <Link
          to="/aggregator/companies/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:opacity-90"
        >
          + Create New Client
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total clients" value={kpis.total} />
        <KpiCard label="In onboarding" value={kpis.onboarding} />
        <KpiCard label="Active" value={kpis.active} />
        <KpiCard label="Expiring in 30 days" value={kpis.expiring} tone="warn" />
      </div>

      {!loading && invoiceProfileMissing && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Set your Invoice-To details once
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Save your company legal name, GSTIN and address so they auto-fill on every new
              client you register.
            </p>
          </div>
          <Link
            to="/aggregator/invoice-profile"
            className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Set up now
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">My Clients</h2>
          {loading && <span className="text-xs text-slate-400">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-5 py-3">Company</th>
                <th className="text-left px-5 py-3">Contact</th>
                <th className="text-left px-5 py-3">Stage</th>
                <th className="text-left px-5 py-3">Contract start</th>
                <th className="text-left px-5 py-3">Contract end</th>
                <th className="text-left px-5 py-3">Days remaining</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(companies ?? []).map((c) => {
                const remaining = daysUntil(c.contractEndDate ?? undefined);
                return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{c.companyName}</div>
                      {c.aggregatorName && (
                        <div className="text-xs text-slate-500">{c.aggregatorName}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{c.contactEmail}</td>
                    <td className="px-5 py-3">
                      <StageBadge stage={c.onboardingStage} />
                    </td>
                    <td className="px-5 py-3 text-slate-700">{formatDate(c.contractStartDate)}</td>
                    <td className="px-5 py-3 text-slate-700">{formatDate(c.contractEndDate)}</td>
                    <td className="px-5 py-3 text-slate-700">
                      {remaining === null ? '—' : `${remaining} day${Math.abs(remaining) === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        className="text-primary text-sm font-medium hover:underline"
                        onClick={() => navigate(`/aggregator/companies/${c.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && (companies?.length ?? 0) === 0 && !error && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    You haven't onboarded any clients yet.{' '}
                    <Link to="/aggregator/companies/new" className="text-primary font-medium">
                      Create your first client
                    </Link>
                    .
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

function KpiCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warn';
}) {
  const color = tone === 'warn' ? '#b45309' : '#0f172a';
  const bg = tone === 'warn' ? '#fffbeb' : '#ffffff';
  return (
    <div
      className="rounded-xl shadow-sm border border-slate-200 p-5"
      style={{ background: bg }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-2" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
