export type CompanyReviewTabId = 'overview' | 'documents' | 'agreements' | 'actions';

export const COMPANY_REVIEW_TABS: { id: CompanyReviewTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'agreements', label: 'Agreements & uploads' },
  { id: 'actions', label: 'Actions' },
];

export function parseTabParam(value: string | null): CompanyReviewTabId {
  if (value === 'documents' || value === 'agreements' || value === 'actions') return value;
  return 'overview';
}
