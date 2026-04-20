import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../services/auth';
import { getMyCompany, type CompanyProfile } from '../services/company';
import { listMyDocuments, type DocumentListItem } from '../services/documents';
import Badge from '../components/Badge';
import OnboardingStepper from '../components/OnboardingStepper';
import NextActionCard from '../components/NextActionCard';
import SummaryCards from '../components/SummaryCards';
import TimelineView from '../components/TimelineView';
import NotificationStrip from '../components/NotificationStrip';
import { FileText, CreditCard, User, CheckCircle, Receipt, CalendarRange } from 'lucide-react';

function formatContractDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bMid - aMid) / msPerDay);
}

function statusBadgeType(company: CompanyProfile): 'active' | 'pending' | 'expired' {
  if (company.renewalStatus === 'EXPIRED') return 'expired';
  if (company.renewalStatus === 'ACTIVE' || company.onboardingStage === 'ACTIVE' || company.onboardingStage === 'COMPLETED') return 'active';
  return 'pending';
}

function statusBadgeLabel(company: CompanyProfile): string {
  const t = statusBadgeType(company);
  if (t === 'active') return 'ACTIVE';
  if (t === 'expired') return 'EXPIRED';
  return 'IN PROGRESS';
}

export default function Dashboard() {
  // Ensure user is authenticated (side effect only)
  void getCurrentUser();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    Promise.all([getMyCompany(), listMyDocuments()])
      .then(([companyData, docsData]) => {
        if (!cancelled) {
          setCompany(companyData);
          setDocuments(Array.isArray(docsData) ? docsData : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
          setCompany(null);
          setDocuments([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-7 w-48 bg-slate-200 rounded" />
        <div className="h-4 w-32 bg-slate-100 rounded" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !company) {
    const errorMessage = error || 'Company not found';
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Dashboard</h1>
        <p className="text-sm text-red-600 mt-2">{errorMessage}</p>
        <p className="text-xs text-slate-500 mt-1">
          Make sure you are signed in with a client account.
        </p>
      </div>
    );
  }

  const stage = company.onboardingStage ?? null;
  const rejectedDocs = documents.filter((d) => d.status === 'REJECTED');
  const agreementDraft = documents.find((d) => d.documentType === 'AGREEMENT_DRAFT');
  const finalAgreement = documents.find((d) => d.documentType === 'AGREEMENT_FINAL');

  // Determine notification
  const notification = getNotification(stage, rejectedDocs.length > 0, agreementDraft, finalAgreement);

  return (
    <div className="space-y-5">
      {/* Welcome Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-0.5">{company.companyName}</p>
        </div>
        <Badge variant={statusBadgeType(company)}>{statusBadgeLabel(company)}</Badge>
      </div>

      {/* Notification Strip */}
      {notification && (
        <NotificationStrip
          type={notification.type}
          message={notification.message}
          action={notification.action}
        />
      )}

      {/* Onboarding Stepper */}
      <OnboardingStepper
        stage={stage}
        showPercentage
        clientChannel={company.clientChannel ?? null}
      />

      {/* Next Action Card */}
      <NextActionCard
        stage={stage}
        agreementDraftId={agreementDraft?.id}
        finalAgreementId={finalAgreement?.id}
      />

      {/* Summary Cards */}
      <SummaryCards stage={stage} />

      {/* Timeline View */}
      <TimelineView stage={stage} />

      {/* Contract Period (when contract dates are set) */}
      {(company.contractStartDate || company.contractEndDate) && (() => {
        const end = company.contractEndDate ? new Date(company.contractEndDate) : null;
        const daysRemaining = end ? daysBetween(new Date(), end) : null;
        const remainingTone =
          daysRemaining == null
            ? 'neutral'
            : daysRemaining < 0
              ? 'expired'
              : daysRemaining <= 30
                ? 'warning'
                : 'active';
        const toneStyles: Record<string, { bg: string; border: string; color: string; label: string }> = {
          active: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', label: 'Active' },
          warning: { bg: '#fff7ed', border: '#fed7aa', color: '#9a3412', label: 'Renewal due soon' },
          expired: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', label: 'Expired' },
          neutral: { bg: '#f8fafc', border: '#e2e8f0', color: '#334155', label: 'Contract set' },
        };
        const tone = toneStyles[remainingTone];
        return (
          <section>
            <p className="section-title">Contract Period</p>
            <div
              className="card p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: tone.border, background: tone.bg }}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 shrink-0" style={{ background: 'rgba(19,75,127,0.08)' }}>
                  <CalendarRange className="h-5 w-5" style={{ color: '#134b7f' }} />
                </div>
                <div className="grid gap-0.5 text-sm">
                  <p className="font-semibold text-slate-900">
                    {formatContractDate(company.contractStartDate)} – {formatContractDate(company.contractEndDate)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {daysRemaining == null
                      ? 'Contract dates recorded.'
                      : daysRemaining < 0
                        ? `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago.`
                        : daysRemaining === 0
                          ? 'Ends today.'
                          : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining.`}
                  </p>
                </div>
              </div>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: '#fff', color: tone.color, border: `1px solid ${tone.border}` }}
              >
                {tone.label}
              </span>
            </div>
          </section>
        );
      })()}

      {/* Quick Links */}
      <section>
        <p className="section-title">Quick Links</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/client/documents"
            className="card flex items-center gap-3 p-4 hover:shadow-md transition-shadow"
          >
            <div className="rounded-lg p-2 shrink-0" style={{ background: 'rgba(19,75,127,0.08)' }}>
              <FileText className="h-5 w-5" style={{ color: '#134b7f' }} />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Documents</p>
              <p className="text-xs text-slate-500">View and manage</p>
            </div>
          </Link>
          <Link
            to="/client/payments"
            className="card flex items-center gap-3 p-4 hover:shadow-md transition-shadow"
          >
            <div className="rounded-lg p-2 shrink-0 bg-emerald-50">
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Payments</p>
              <p className="text-xs text-slate-500">Payment history</p>
            </div>
          </Link>
          <Link
            to="/client/invoices"
            className="card flex items-center gap-3 p-4 hover:shadow-md transition-shadow"
          >
            <div className="rounded-lg p-2 shrink-0" style={{ background: 'rgba(19,75,127,0.08)' }}>
              <Receipt className="h-5 w-5" style={{ color: '#134b7f' }} />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Invoices</p>
              <p className="text-xs text-slate-500">GST invoices</p>
            </div>
          </Link>
          <Link
            to="/client/profile"
            className="card flex items-center gap-3 p-4 hover:shadow-md transition-shadow"
          >
            <div className="rounded-lg p-2 shrink-0 bg-teal-50">
              <User className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Profile</p>
              <p className="text-xs text-slate-500">Company details</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Success Banner for Active Accounts */}
      {(stage === 'ACTIVE' || stage === 'COMPLETED') && (
        <div className="card p-5 flex items-center gap-4" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          <CheckCircle className="h-8 w-8 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Account active and ready</p>
            <p className="text-xs text-emerald-600 mt-0.5">You have full access to all features.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function getNotification(
  stage: string | null,
  hasRejectedDocs: boolean,
  agreementDraft: DocumentListItem | undefined,
  finalAgreement: DocumentListItem | undefined,
) {
  if (hasRejectedDocs) {
    return {
      type: 'error' as const,
      message: 'Some documents were rejected. Please re-upload them.',
      action: {
        label: 'View Documents',
        onClick: () => (window.location.href = '/client/documents'),
      },
    };
  }

  if (stage === 'AGREEMENT_DRAFT_SHARED' && agreementDraft) {
    return {
      type: 'warning' as const,
      message: 'Agreement draft is ready for review and signing.',
      action: {
        label: 'View Agreement',
        onClick: () => (window.location.href = '/client/documents'),
      },
    };
  }

  if (stage === 'FINAL_AGREEMENT_SHARED' && finalAgreement) {
    return {
      type: 'success' as const,
      message: 'Final agreement is ready for download.',
      action: {
        label: 'Download Now',
        onClick: () => (window.location.href = '/client/documents'),
      },
    };
  }

  return null;
}
