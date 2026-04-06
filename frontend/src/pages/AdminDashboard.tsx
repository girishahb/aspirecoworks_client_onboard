import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import { listCompanies, getDashboardStats, type AdminCompany, type DashboardStats } from '../services/admin';
import Badge from '../components/Badge';
import MetricCard from '../components/MetricCard';
import PipelineVisualization from '../components/PipelineVisualization';
import {
  Users,
  CheckCircle,
  CreditCard,
  FileCheck,
  FileText,
  Zap,
  TrendingUp,
  Calendar,
} from 'lucide-react';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function companyStatus(company: AdminCompany): 'active' | 'inactive' {
  if (company.renewalStatus === 'EXPIRED') return 'inactive';
  if (company.renewalStatus === 'ACTIVE') return 'active';
  if (company.onboardingStage === 'ACTIVE' || company.onboardingStage === 'COMPLETED') return 'active';
  return 'inactive';
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

function onboardingStageLabel(stage: string | null | undefined): string {
  return stage ? (STAGE_LABELS[stage] ?? stage) : '—';
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);

    Promise.all([getDashboardStats(), listCompanies()])
      .then(([statsData, companiesData]) => {
        if (!cancelled) {
          setStats(statsData);
          setCompanies(companiesData);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
          setStats(null);
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

  function handleRowClick(companyId: string) {
    navigate(`/admin/companies/${companyId}`);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-7 w-48 bg-slate-200 rounded" />
        <div className="h-4 w-32 bg-slate-100 rounded" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Admin Dashboard</h1>
        <p className="text-sm text-red-600 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of clients and onboarding pipeline</p>
        </div>
        <Link
          to="/admin/companies/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ background: '#134b7f' }}
        >
          + New Client
        </Link>
      </div>

      {stats && (
        <>
          {/* Top Metric Cards */}
          <section>
            <p className="section-title">Overview</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                title="Total Clients"
                value={stats.totalCompanies}
                icon={Users}
                bgColor="bg-primary/10"
                iconColor="text-primary"
              />
              <MetricCard
                title="Active Clients"
                value={stats.activeCompanies}
                icon={CheckCircle}
                bgColor="bg-success/10"
                iconColor="text-success"
              />
              <MetricCard
                title="Payment Pending"
                value={stats.paymentPending}
                icon={CreditCard}
                bgColor="bg-accent/10"
                iconColor="text-accent"
              />
              <MetricCard
                title="KYC Pending"
                value={stats.kycPending}
                icon={FileCheck}
                bgColor="bg-accent/10"
                iconColor="text-accent"
              />
              <MetricCard
                title="Agreements Pending"
                value={stats.agreementsPending}
                icon={FileText}
                bgColor="bg-accent/10"
                iconColor="text-accent"
              />
              <MetricCard
                title="Ready for Activation"
                value={stats.readyForActivation}
                icon={Zap}
                bgColor="bg-success/10"
                iconColor="text-success"
              />
            </div>
          </section>

          {/* Revenue Section */}
          <section>
            <p className="section-title">Revenue</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Revenue Collected</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {formatCurrency(stats.totalRevenue)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <TrendingUp className="h-6 w-6 text-emerald-600" strokeWidth={2} />
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Revenue This Month</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {formatCurrency(stats.revenueThisMonth)}
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(19,75,127,0.08)' }}>
                    <Calendar className="h-6 w-6" style={{ color: '#134b7f' }} strokeWidth={2} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Pipeline Visualization */}
          <section>
            <PipelineVisualization stats={stats} />
          </section>

          {/* Quick Action Panel */}
          <section>
            <p className="section-title">Quick Actions</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/companies/new')}
                className="rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                Create Client
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Review KYC button clicked');
                  // Filter to KYC pending companies
                  const kycCompanies = companies.filter(
                    (c) => c.onboardingStage === 'KYC_IN_PROGRESS' || c.onboardingStage === 'KYC_REVIEW',
                  );
                  console.log('KYC companies found:', kycCompanies.length);
                  if (kycCompanies.length > 0) {
                    navigate(`/admin/companies/${kycCompanies[0].id}`);
                  } else {
                    // Navigate to companies list if no KYC companies found
                    if (companies.length > 0) {
                      console.log('Navigating to first company:', companies[0].id);
                      navigate(`/admin/companies/${companies[0].id}`);
                    } else {
                      alert('No companies found. Create a client first.');
                    }
                  }
                }}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-background"
              >
                Review KYC
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Upload Agreements button clicked');
                  // Filter to agreement pending companies
                  const agreementCompanies = companies.filter(
                    (c) =>
                      c.onboardingStage === 'AGREEMENT_DRAFT_SHARED' ||
                      c.onboardingStage === 'SIGNED_AGREEMENT_RECEIVED',
                  );
                  console.log('Agreement companies found:', agreementCompanies.length);
                  if (agreementCompanies.length > 0) {
                    navigate(`/admin/companies/${agreementCompanies[0].id}`);
                  } else {
                    // Navigate to companies list if no agreement companies found
                    if (companies.length > 0) {
                      console.log('Navigating to first company:', companies[0].id);
                      navigate(`/admin/companies/${companies[0].id}`);
                    } else {
                      alert('No companies found. Create a client first.');
                    }
                  }
                }}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-background"
              >
                Upload Agreements
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Activate Clients button clicked');
                  // Filter to ready for activation
                  const readyCompanies = companies.filter(
                    (c) => c.onboardingStage === 'FINAL_AGREEMENT_SHARED',
                  );
                  console.log('Ready companies found:', readyCompanies.length);
                  if (readyCompanies.length > 0) {
                    navigate(`/admin/companies/${readyCompanies[0].id}`);
                  } else {
                    // Navigate to companies list if no ready companies found
                    if (companies.length > 0) {
                      console.log('Navigating to first company:', companies[0].id);
                      navigate(`/admin/companies/${companies[0].id}`);
                    } else {
                      alert('No companies found. Create a client first.');
                    }
                  }
                }}
                className="rounded-lg border border-success bg-success px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-success/90"
              >
                Activate Clients
              </button>
            </div>
          </section>
        </>
      )}

      {/* Companies Table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">All Clients</p>
          <span className="text-xs text-slate-400">{companies.length} total</span>
        </div>
        {companies.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-slate-500 text-sm">No clients yet. Create your first one to get started.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company name</th>
                    <th>Onboarding stage</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr
                      key={company.id}
                      onClick={() => handleRowClick(company.id)}
                    >
                      <td className="font-medium text-slate-900">{company.companyName}</td>
                      <td>{onboardingStageLabel(company.onboardingStage)}</td>
                      <td>
                        <Badge variant={companyStatus(company)}>
                          {companyStatus(company) === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="text-slate-500">{formatDate(company.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
