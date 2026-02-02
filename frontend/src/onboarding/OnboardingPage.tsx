import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { ComplianceStatus, CompanyMe, DocumentListItem } from '../api/types';
import {
  getOnboardingState,
  type OnboardingState,
} from './state';
import { OnboardingMissingDocuments } from './OnboardingMissingDocuments';
import { OnboardingPendingApproval } from './OnboardingPendingApproval';
import { OnboardingActivated } from './OnboardingActivated';
import { OnboardingBlocked } from './OnboardingBlocked';

export function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [company, setCompany] = useState<CompanyMe | null>(null);
  const [state, setState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [complianceRes, companyRes, documentsRes] = await Promise.all([
          apiGet<ComplianceStatus>('/compliance/status'),
          apiGet<CompanyMe>('/companies/me'),
          apiGet<DocumentListItem[]>('/documents').catch(() => []),
        ]);
        if (cancelled) return;
        const docList = Array.isArray(documentsRes) ? documentsRes : [];
        setCompliance(complianceRes);
        setCompany(companyRes);
        setState(getOnboardingState(complianceRes, companyRes, docList));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <p className="text-sm text-stone-500">Sign in or check your connection.</p>
        </div>
      </div>
    );
  }

  if (!compliance || !company || state === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-500">Unable to determine onboarding status.</p>
      </div>
    );
  }

  switch (state) {
    case 'renewal_expired':
      return <OnboardingBlocked companyName={company.companyName} />;
    case 'compliant':
      return (
        <OnboardingActivated
          companyName={company.companyName}
          renewalDate={company.renewalDate}
        />
      );
    case 'pending_approval':
      return <OnboardingPendingApproval companyName={company.companyName} />;
    case 'missing_documents':
      return (
        <OnboardingMissingDocuments
          companyName={company.companyName}
          missingDocumentTypes={compliance.missingDocumentTypes}
        />
      );
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <p className="text-stone-500">Unknown state.</p>
        </div>
      );
  }
}
