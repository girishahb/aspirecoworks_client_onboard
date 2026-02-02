import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import type {
  DocumentListItem,
  ComplianceStatus,
  AdminCompany,
} from '../api/types';
import {
  ReviewActionModal,
  type ReviewActionType,
} from '../components/ReviewActionModal';

function statusLabel(status: string): string {
  switch (status) {
    case 'VERIFIED':
      return 'Approved';
    case 'UPLOADED':
    case 'PENDING':
      return 'Pending';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

function formatRenewalDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isRenewalValid(renewalDate: string | null): boolean {
  if (!renewalDate) return false;
  const d = new Date(renewalDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

interface ComplianceSummaryPanelProps {
  compliance: ComplianceStatus | null;
  company: AdminCompany | null;
}

function ComplianceSummaryPanel({
  compliance,
  company,
}: ComplianceSummaryPanelProps) {
  if (!compliance) return null;

  const renewalDate = company?.renewalDate ?? null;
  const validRenewal = isRenewalValid(renewalDate);
  const active = compliance.isCompliant && validRenewal;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">
            Compliance summary
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div>
              <dt className="inline font-medium text-stone-500">Compliant: </dt>
              <dd className="inline text-stone-900">
                {compliance.isCompliant ? 'Yes' : 'No'}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-stone-500">
                Missing document types:{' '}
              </dt>
              <dd className="inline text-stone-900">
                {compliance.missingDocumentTypes?.length
                  ? compliance.missingDocumentTypes.join(', ')
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-stone-500">
                Renewal date:{' '}
              </dt>
              <dd className="inline text-stone-900">
                {formatRenewalDate(renewalDate)}
              </dd>
            </div>
          </dl>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            active
              ? 'bg-green-100 text-green-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {active ? 'Company Active' : 'Company Inactive'}
        </span>
      </div>
    </div>
  );
}

/**
 * Admin Document Review page.
 * Route: /admin/companies/:id (param id = companyId)
 */
export function AdminCompanyDocumentsPage() {
  const params = useParams<{ id?: string; companyId?: string }>();
  const companyId = params.id ?? params.companyId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [company, setCompany] = useState<AdminCompany | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    documentId: string;
    actionType: ReviewActionType;
  } | null>(null);

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    async function load() {
      try {
        const [complianceRes, documentsRes, companiesRes] = await Promise.all([
          apiGet<ComplianceStatus>(`/compliance/company/${companyId}`).catch(
            () => null,
          ),
          apiGet<DocumentListItem[]>(`/documents/company/${companyId}`).catch(
            () => [],
          ),
          apiGet<AdminCompany[]>('/companies').catch(() => []),
        ]);

        if (cancelled) return;

        setCompliance(complianceRes ?? null);
        setDocuments(Array.isArray(documentsRes) ? documentsRes : []);
        const companies = Array.isArray(companiesRes) ? companiesRes : [];
        const found = companies.find((c) => c.id === companyId) ?? null;
        setCompany(found);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load page');
          setDocuments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const refetchDocuments = useCallback(() => {
    if (companyId) {
      apiGet<DocumentListItem[]>(`/documents/company/${companyId}`)
        .then((list) => setDocuments(Array.isArray(list) ? list : []))
        .catch(() => {});
    }
  }, [companyId]);

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <p className="text-stone-500">Missing company ID.</p>
        <Link to="/admin/companies" className="ml-2 text-stone-600 underline">
          Back to companies
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <p className="text-stone-500">Loading documents…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 p-6">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/admin/companies"
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            ← Back to companies
          </Link>
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const canReview = (status: string) =>
    status === 'UPLOADED' || status === 'PENDING' || status === 'REJECTED';

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/admin/companies"
          className="text-sm text-stone-600 hover:text-stone-900"
        >
          ← Back to companies
        </Link>

        <div className="mt-6">
          <ComplianceSummaryPanel compliance={compliance} company={company} />
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-stone-900">
          Review documents
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Company ID: {companyId}
        </p>

        {documents.length === 0 ? (
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-12 text-center shadow-sm">
            <p className="text-stone-500">No documents for this company.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="px-4 py-3 font-medium text-stone-700">
                    Document type
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-700">
                    File name
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-700">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-stone-900">
                      {doc.documentType}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {doc.fileName}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {statusLabel(doc.status)}
                      {doc.status === 'REJECTED' && doc.rejectionReason && (
                        <span className="block mt-1 text-xs text-red-600">
                          {doc.rejectionReason}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canReview(doc.status) ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setReviewModal({
                                documentId: doc.id,
                                actionType: 'APPROVE',
                              })
                            }
                            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReviewModal({
                                documentId: doc.id,
                                actionType: 'REJECT',
                              })
                            }
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewModal && (
        <ReviewActionModal
          documentId={reviewModal.documentId}
          actionType={reviewModal.actionType}
          onClose={() => setReviewModal(null)}
          onSuccess={refetchDocuments}
        />
      )}
    </div>
  );
}
