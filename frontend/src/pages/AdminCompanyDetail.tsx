import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCompany,
  listCompanyDocuments,
  approveDocument,
  rejectDocument,
  markDocumentPendingWithClient,
  uploadAgreementDraft,
  uploadFinalAgreement,
  activateCompany,
  getComplianceStatus,
  type AdminCompany,
  type AdminDocumentListItem,
  type ComplianceStatus,
} from '../services/admin';
import { downloadDocument } from '../services/documents';
import Badge from '../components/Badge';
import OnboardingStepper from '../components/OnboardingStepper';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function documentStatusVariant(status: string): 'approved' | 'rejected' | 'pending' {
  if (status === 'VERIFIED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
}

function documentStatusLabel(status: string): string {
  if (status === 'VERIFIED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'UPLOADED' || status === 'REVIEW_PENDING') return 'Pending review';
  if (status === 'PENDING_WITH_CLIENT') return 'Pending with client';
  if (status === 'PENDING') return 'Pending';
  return status;
}

/** Doc is awaiting admin action or was sent back to client (admin can change decision). */
function isReviewable(status: string): boolean {
  return status === 'REVIEW_PENDING' || status === 'PENDING_WITH_CLIENT';
}

function onboardingStageLabel(stage: string | null | undefined): string {
  if (!stage) return '—';
  const labels: Record<string, string> = {
    ADMIN_CREATED: 'Admin created',
    PENDING_DOCUMENTS: 'Pending documents',
    DOCUMENTS_SUBMITTED: 'Documents submitted',
    UNDER_REVIEW: 'Under review',
    PAYMENT_CONFIRMED: 'Payment confirmed',
    KYC_IN_PROGRESS: 'KYC in progress',
    KYC_REVIEW: 'KYC review',
    AGREEMENT_DRAFT_SHARED: 'Agreement draft shared',
    SIGNED_AGREEMENT_RECEIVED: 'Signed agreement received',
    FINAL_AGREEMENT_SHARED: 'Final agreement shared',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
  };
  return labels[stage] ?? stage;
}

/** Ordered onboarding stages for pipeline display */
const ONBOARDING_STAGE_ORDER = [
  'PAYMENT_CONFIRMED',
  'KYC_IN_PROGRESS',
  'KYC_REVIEW',
  'AGREEMENT_DRAFT_SHARED',
  'SIGNED_AGREEMENT_RECEIVED',
  'FINAL_AGREEMENT_SHARED',
  'ACTIVE',
] as const;

function getStageOrder(stage: string | null | undefined): number {
  if (!stage) return -1;
  const i = ONBOARDING_STAGE_ORDER.indexOf(stage as (typeof ONBOARDING_STAGE_ORDER)[number]);
  return i >= 0 ? i : -1;
}

export default function AdminCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<AdminCompany | null>(null);
  const [documents, setDocuments] = useState<AdminDocumentListItem[]>([]);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activateBusy, setActivateBusy] = useState(false);
  const [agreementDraftFile, setAgreementDraftFile] = useState<File | null>(null);
  const [agreementDraftUploading, setAgreementDraftUploading] = useState(false);
  const [agreementDraftError, setAgreementDraftError] = useState<string | null>(null);
  const [finalAgreementFile, setFinalAgreementFile] = useState<File | null>(null);
  const [finalAgreementUploading, setFinalAgreementUploading] = useState(false);
  const [finalAgreementError, setFinalAgreementError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const [companyData, docsData, complianceData] = await Promise.all([
        getCompany(companyId),
        listCompanyDocuments(companyId),
        getComplianceStatus(companyId).catch(() => null),
      ]);
      setCompany(companyData);
      setDocuments(Array.isArray(docsData) ? docsData : []);
      setCompliance(complianceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company');
      setCompany(null);
      setDocuments([]);
      setCompliance(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleApprove(docId: string) {
    if (!window.confirm('Approve this document?')) return;
    const adminRemarks = window.prompt('Admin remarks (optional):') ?? undefined;
    setActionError(null);
    setBusyId(docId);
    try {
      await approveDocument(docId, adminRemarks);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(docId: string) {
    const reason = window.prompt('Rejection reason (required):');
    if (reason === null || !reason.trim()) return;
    const adminRemarks = window.prompt('Admin remarks (optional):') ?? undefined;
    setActionError(null);
    setBusyId(docId);
    try {
      await rejectDocument(docId, reason.trim(), adminRemarks);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkPendingWithClient(docId: string) {
    if (!window.confirm('Mark this document as Pending with Client? The client may re-upload or respond.')) return;
    const adminRemarks = window.prompt('Admin remarks (optional):') ?? undefined;
    setActionError(null);
    setBusyId(docId);
    try {
      await markDocumentPendingWithClient(docId, adminRemarks);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Mark pending failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(docId: string) {
    try {
      const { downloadUrl } = await downloadDocument(docId);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function handleUploadAgreementDraft() {
    if (!companyId || !agreementDraftFile) return;
    setAgreementDraftError(null);
    setAgreementDraftUploading(true);
    try {
      await uploadAgreementDraft(companyId, agreementDraftFile);
      setAgreementDraftFile(null);
      await loadData();
    } catch (err) {
      setAgreementDraftError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAgreementDraftUploading(false);
    }
  }

  async function handleUploadFinalAgreement() {
    if (!companyId || !finalAgreementFile) return;
    setFinalAgreementError(null);
    setFinalAgreementUploading(true);
    try {
      await uploadFinalAgreement(companyId, finalAgreementFile);
      setFinalAgreementFile(null);
      await loadData();
    } catch (err) {
      setFinalAgreementError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setFinalAgreementUploading(false);
    }
  }

  const isAlreadyActive =
    company?.onboardingStage === 'ACTIVE' || company?.onboardingStage === 'COMPLETED';
  const canActivate = company?.onboardingStage === 'FINAL_AGREEMENT_SHARED';

  async function handleActivate() {
    if (!companyId || !canActivate) return;
    if (!window.confirm(`Activate ${company?.companyName}?`)) return;
    setActionError(null);
    setActivateBusy(true);
    try {
      await activateCompany(companyId);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActivateBusy(false);
    }
  }

  if (!companyId) {
    return (
      <div>
        <p style={{ color: 'crimson' }}>Missing company ID.</p>
        <button type="button" onClick={() => navigate('/admin/dashboard')}>
          Back to dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1>Company review</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div>
        <h1>Company review</h1>
        <p style={{ color: 'crimson' }}>{error ?? 'Company not found.'}</p>
        <button type="button" onClick={() => navigate('/admin/dashboard')}>
          Back to dashboard
        </button>
      </div>
    );
  }

  const currentStageOrder = getStageOrder(company.onboardingStage);

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => navigate('/admin/dashboard')}>
          ← Back to dashboard
        </button>
      </div>

      <h1>Company review</h1>

      {/* Visual onboarding progress stepper */}
      <section style={{ marginTop: '1rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.125rem' }}>Onboarding progress</h2>
        <OnboardingStepper stage={company.onboardingStage} showPercentage />
      </section>

      {/* Prominent onboarding stage */}
      <section
        style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
          borderRadius: 8,
          border: `2px solid ${company.onboardingStage === 'ACTIVE' || company.onboardingStage === 'COMPLETED' ? '#2e7d32' : company.onboardingStage === 'REJECTED' ? '#c62828' : '#1565c0'}`,
          backgroundColor: company.onboardingStage === 'ACTIVE' || company.onboardingStage === 'COMPLETED' ? '#e8f5e9' : company.onboardingStage === 'REJECTED' ? '#ffebee' : '#e3f2fd',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem', color: '#333' }}>
          Onboarding stage
        </h2>
        <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
          {onboardingStageLabel(company.onboardingStage)}
        </p>
        {company.activationDate && (
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#555' }}>
            Activated on {formatDate(company.activationDate)}
          </p>
        )}
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.25rem 0.5rem',
            alignItems: 'center',
          }}
        >
          {ONBOARDING_STAGE_ORDER.map((s, i) => {
            const order = getStageOrder(s);
            const reached = currentStageOrder >= order;
            const current = company.onboardingStage === s;
            return (
              <span
                key={s}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 4,
                  backgroundColor: current ? '#1565c0' : reached ? '#c8e6c9' : '#eee',
                  color: current ? '#fff' : reached ? '#1b5e20' : '#999',
                  fontWeight: current ? 600 : 400,
                }}
              >
                {onboardingStageLabel(s)}
              </span>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Company profile</h2>
        <p><strong>Company name:</strong> {company.companyName}</p>
        <p><strong>Contact email:</strong> {company.contactEmail}</p>
        {company.contactPhone && <p><strong>Contact phone:</strong> {company.contactPhone}</p>}
        <p><strong>Renewal date:</strong> {formatDate(company.renewalDate)}</p>
        <p><strong>Renewal status:</strong> {company.renewalStatus ?? '—'}</p>
        {company.address && (
          <p><strong>Address:</strong> {[company.address, company.city, company.state, company.zipCode, company.country].filter(Boolean).join(', ')}</p>
        )}
        {company.notes && <p><strong>Notes:</strong> {company.notes}</p>}
        {compliance && (
          <p><strong>Compliance:</strong> {compliance.isCompliant ? 'Compliant' : 'Missing documents'}{compliance.missingDocumentTypes?.length ? ` (${compliance.missingDocumentTypes.join(', ')})` : ''}</p>
        )}
        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={handleActivate}
            disabled={!canActivate || activateBusy}
          >
            {activateBusy ? 'Activating…' : 'Activate Company'}
          </button>
          {!canActivate && !isAlreadyActive && (
            <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.875rem' }}>
              Activate only when stage is &quot;Final agreement shared&quot;.
            </p>
          )}
          {isAlreadyActive && (
            <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.875rem' }}>Company is already active.</p>
          )}
        </div>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Documents</h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#555' }}>
          Download any file; use Approve / Reject / Pending with client for documents awaiting review.
        </p>
        <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 4 }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Upload agreement draft</h3>
          <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: '#666' }}>
            Upload a draft agreement. The client will be notified by email and the onboarding stage will be set to &quot;Agreement draft shared&quot;.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setAgreementDraftFile(e.target.files?.[0] ?? null)}
              disabled={agreementDraftUploading}
            />
            <button
              type="button"
              onClick={handleUploadAgreementDraft}
              disabled={!agreementDraftFile || agreementDraftUploading}
            >
              {agreementDraftUploading ? 'Uploading…' : 'Upload and notify client'}
            </button>
          </div>
          {agreementDraftError && (
            <p style={{ color: 'crimson', fontSize: '0.875rem', marginTop: '0.5rem' }}>{agreementDraftError}</p>
          )}
        </div>
        <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #1565c0', borderRadius: 4, backgroundColor: '#e3f2fd' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Upload final agreement</h3>
          <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: '#666' }}>
            Upload the final agreement. The client will be notified by email and the onboarding stage will be set to &quot;Final agreement shared&quot;.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFinalAgreementFile(e.target.files?.[0] ?? null)}
              disabled={finalAgreementUploading}
            />
            <button
              type="button"
              onClick={handleUploadFinalAgreement}
              disabled={!finalAgreementFile || finalAgreementUploading}
            >
              {finalAgreementUploading ? 'Uploading…' : 'Upload and notify client'}
            </button>
          </div>
          {finalAgreementError && (
            <p style={{ color: 'crimson', fontSize: '0.875rem', marginTop: '0.5rem' }}>{finalAgreementError}</p>
          )}
        </div>
        {actionError && (
          <p style={{ color: 'crimson', marginBottom: '0.5rem' }}>{actionError}</p>
        )}
        {documents.length === 0 ? (
          <p>No documents.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Document</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Type</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Timeline</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span style={{ fontWeight: 500 }}>{doc.fileName}</span>
                    {doc.version != null && doc.version > 1 && (
                      <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: '#666' }}>v{doc.version}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{doc.documentType}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <Badge variant={documentStatusVariant(doc.status)}>
                      {documentStatusLabel(doc.status)}
                    </Badge>
                    {doc.rejectionReason && doc.status === 'REJECTED' && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#666' }}>{doc.rejectionReason}</div>
                    )}
                    {doc.adminRemarks && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#555' }}>Remarks: {doc.adminRemarks}</div>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                    <div>Uploaded: {formatDate(doc.createdAt)}</div>
                    {(doc.verifiedAt || ['VERIFIED', 'REJECTED', 'PENDING_WITH_CLIENT'].includes(doc.status)) && (doc.verifiedAt || doc.updatedAt) && (
                      <div style={{ color: '#555' }}>
                        Reviewed: {formatDate(doc.verifiedAt ?? doc.updatedAt)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc.id)}
                        style={{ marginRight: 0 }}
                      >
                        Download
                      </button>
                      {isReviewable(doc.status) && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(doc.id)}
                            disabled={busyId !== null}
                            style={{ backgroundColor: '#2e7d32', color: '#fff', border: '1px solid #2e7d32' }}
                          >
                            {busyId === doc.id ? '…' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(doc.id)}
                            disabled={busyId !== null}
                            style={{ backgroundColor: '#c62828', color: '#fff', border: '1px solid #c62828' }}
                          >
                            {busyId === doc.id ? '…' : 'Reject'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkPendingWithClient(doc.id)}
                            disabled={busyId !== null}
                          >
                            {busyId === doc.id ? '…' : 'Pending with client'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
