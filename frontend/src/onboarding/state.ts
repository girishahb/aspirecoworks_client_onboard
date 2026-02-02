import type { ComplianceStatus, CompanyMe, DocumentListItem } from '../api/types';

/** Derived onboarding state – not hardcoded; computed from API data. */
export type OnboardingState =
  | 'renewal_expired'
  | 'compliant'
  | 'pending_approval'
  | 'missing_documents';

const PENDING_STATUSES = ['PENDING', 'UPLOADED'];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isRenewalExpired(renewalDate: string | null): boolean {
  if (!renewalDate) return false;
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  return renewal.getTime() < startOfToday().getTime();
}

/**
 * Returns true if every missing document type has at least one document
 * with status PENDING or UPLOADED (i.e. submitted but not yet verified).
 */
function hasPendingUploadsForMissing(
  missingDocumentTypes: string[],
  documents: DocumentListItem[],
): boolean {
  if (missingDocumentTypes.length === 0) return false;
  const pendingTypes = new Set(
    documents
      .filter((d) => PENDING_STATUSES.includes(d.status))
      .map((d) => d.documentType),
  );
  return missingDocumentTypes.every((type) => pendingTypes.has(type));
}

/**
 * Derive onboarding state from compliance, company, and documents.
 * Order: renewal expired → compliant → pending approval → missing documents.
 */
export function getOnboardingState(
  compliance: ComplianceStatus,
  company: CompanyMe,
  documents: DocumentListItem[],
): OnboardingState {
  if (isRenewalExpired(company.renewalDate)) return 'renewal_expired';
  if (compliance.isCompliant) return 'compliant';
  if (
    compliance.missingDocumentTypes.length > 0 &&
    hasPendingUploadsForMissing(compliance.missingDocumentTypes, documents)
  ) {
    return 'pending_approval';
  }
  return 'missing_documents';
}
