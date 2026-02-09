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
import { FileText, CreditCard, User, CheckCircle, Receipt } from 'lucide-react';

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
      <div>
        <h1>Dashboard</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (error || !company) {
    const errorMessage = error || 'Company not found';
    const isForbidden = errorMessage.toLowerCase().includes('forbidden') || 
                       errorMessage.toLowerCase().includes('no company');
    
    return (
      <div>
        <h1>Dashboard</h1>
        <div style={{ color: 'crimson', marginTop: '1rem' }}>
          <p><strong>Error:</strong> {errorMessage}</p>
          {isForbidden && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
              <p><strong>Possible causes:</strong></p>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                <li>Your account is not linked to a company</li>
                <li>You need to log in with a CLIENT account</li>
                <li>Try logging in with: <code>client@example.com</code> / <code>Client123!</code></li>
              </ul>
            </div>
          )}
        </div>
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
    <div>
      {/* Welcome Header */}
      <section className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Welcome back</h1>
            <p className="mt-1 text-muted">{company.companyName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusBadgeType(company)}>{statusBadgeLabel(company)}</Badge>
          </div>
        </div>
      </section>

      {/* Notification Strip */}
      {notification && (
        <NotificationStrip
          type={notification.type}
          message={notification.message}
          action={notification.action}
        />
      )}

      {/* Onboarding Stepper */}
      {stage !== 'ACTIVE' && stage !== 'COMPLETED' && (
        <section className="mb-6">
          <OnboardingStepper stage={stage} showPercentage />
        </section>
      )}

      {/* Next Action Card */}
      <section className="mb-6">
        <NextActionCard
          stage={stage}
          agreementDraftId={agreementDraft?.id}
          finalAgreementId={finalAgreement?.id}
        />
      </section>

      {/* Summary Cards */}
      <section className="mb-6">
        <SummaryCards stage={stage} />
      </section>

      {/* Timeline View */}
      <section className="mb-6">
        <TimelineView stage={stage} />
      </section>

      {/* Quick Links */}
      <section className="mb-6">
        <h2 className="mb-4 text-lg font-semibold">Quick Links</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            to="/client/documents"
            className="flex items-center gap-3 rounded-lg border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Document Center</h3>
              <p className="text-xs text-muted">View and manage documents</p>
            </div>
          </Link>
          <Link
            to="/client/payments"
            className="flex items-center gap-3 rounded-lg border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="rounded-lg bg-success/10 p-2">
              <CreditCard className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Payments</h3>
              <p className="text-xs text-muted">View payment history</p>
            </div>
          </Link>
          <Link
            to="/client/invoices"
            className="flex items-center gap-3 rounded-lg border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="rounded-lg bg-primary/10 p-2">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Invoices</h3>
              <p className="text-xs text-muted">Download GST invoices</p>
            </div>
          </Link>
          <Link
            to="/client/profile"
            className="flex items-center gap-3 rounded-lg border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="rounded-lg bg-accent/10 p-2">
              <User className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Company Profile</h3>
              <p className="text-xs text-muted">View company details</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Success Banner for Active Accounts */}
      {(stage === 'ACTIVE' || stage === 'COMPLETED') && (
        <section className="mb-6">
          <div className="rounded-lg border-2 border-success bg-success/10 p-6 text-center">
            <CheckCircle className="mx-auto mb-2 h-12 w-12 text-success" />
            <h3 className="mb-1 text-lg font-semibold text-success">Your account is active and ready</h3>
            <p className="text-sm text-muted">You have full access to all features.</p>
          </div>
        </section>
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
