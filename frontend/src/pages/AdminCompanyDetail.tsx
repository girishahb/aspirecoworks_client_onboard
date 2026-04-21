import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getCompany,
  listCompanyDocuments,
  approveDocument,
  rejectDocument,
  markDocumentPendingWithClient,
  uploadAgreementDraft,
  generateAgreementDraftFromTemplate,
  notifyAgreementDraftShared,
  uploadFinalAgreement,
  type AdminPostAgreementDocumentType,
  activateCompany,
  getComplianceStatus,
  updateCompanyStage,
  getCompanyPaymentHistory,
  createPayment,
  resendPaymentLink,
  markPaymentAsPaid,
  resendInvite,
  deleteCompany,
  type AdminCompany,
  type AdminDocumentListItem,
  type ComplianceStatus,
  type CompanyPaymentHistory,
} from '../services/admin';

/** Post-agreement document types admin can upload; only Final Agreement triggers notify + stage change. */
const POST_AGREEMENT_DOC_TYPES: { value: AdminPostAgreementDocumentType; label: string }[] = [
  { value: 'AGREEMENT_FINAL', label: 'Final Agreement' },
  { value: 'NOC_ASPIRE_COWORKS', label: 'NOC from Aspire Coworks' },
  { value: 'NOC_LANDLORD', label: 'NOC from Landlord' },
  { value: 'ELECTRICITY_BILL', label: 'Electricity Bill' },
  { value: 'WIFI_BILL', label: 'Wifi Bill' },
];
import { getCurrentUser } from '../services/auth';
import {
  downloadDocumentFile,
  getDocumentViewUrl,
  uploadAggregatorSignedAgreement,
} from '../services/documents';
import {
  listCompanyBookings,
  type AggregatorBooking,
} from '../services/aggregatorProfile';
import Badge from '../components/Badge';
import DocumentViewer from '../components/DocumentViewer';
import OnboardingStepper from '../components/OnboardingStepper';
import { Eye, Download } from 'lucide-react';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function documentStatusVariant(status: string): 'approved' | 'rejected' | 'pending' {
  if (status === 'VERIFIED' || status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
}

function documentStatusLabel(status: string): string {
  if (status === 'VERIFIED' || status === 'APPROVED') return 'Approved';
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
    PAYMENT_PENDING: 'Payment pending',
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
  const location = useLocation();
  const inviteSentFromCreate = (location.state as { inviteSent?: boolean })?.inviteSent === true;
  const [company, setCompany] = useState<AdminCompany | null>(null);
  const [documents, setDocuments] = useState<AdminDocumentListItem[]>([]);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activateBusy, setActivateBusy] = useState(false);
  const [kycCompleteBusy, setKycCompleteBusy] = useState(false);
  const [agreementDraftFiles, setAgreementDraftFiles] = useState<File[]>([]);
  const [agreementDraftUploading, setAgreementDraftUploading] = useState(false);
  const [agreementDraftError, setAgreementDraftError] = useState<string | null>(null);
  const [templateDraftGenerating, setTemplateDraftGenerating] = useState(false);
  const [templateDraftSuccess, setTemplateDraftSuccess] = useState<string | null>(null);
  const [notifyDraftBusyId, setNotifyDraftBusyId] = useState<string | null>(null);
  const [notifyDraftSuccess, setNotifyDraftSuccess] = useState<string | null>(null);
  const [notifyDraftError, setNotifyDraftError] = useState<string | null>(null);
  const [aggregatorSignedFile, setAggregatorSignedFile] = useState<File | null>(null);
  const [aggregatorSignedUploading, setAggregatorSignedUploading] = useState(false);
  const [aggregatorSignedSuccess, setAggregatorSignedSuccess] = useState<string | null>(null);
  const [aggregatorSignedError, setAggregatorSignedError] = useState<string | null>(null);
  const [finalAgreementFile, setFinalAgreementFile] = useState<File | null>(null);
  const [selectedFinalDocType, setSelectedFinalDocType] = useState<AdminPostAgreementDocumentType>('AGREEMENT_FINAL');
  const [finalAgreementUploading, setFinalAgreementUploading] = useState(false);
  const [finalAgreementError, setFinalAgreementError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<CompanyPaymentHistory | null>(null);
  const [bookings, setBookings] = useState<AggregatorBooking[] | null>(null);
  const [paymentCreating, setPaymentCreating] = useState(false);
  const [paymentResending, setPaymentResending] = useState<string | null>(null);
  const [markPaidBusy, setMarkPaidBusy] = useState<string | null>(null);
  const [inviteSentBanner, setInviteSentBanner] = useState(inviteSentFromCreate);
  const [resendInviteBusy, setResendInviteBusy] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('50000'); // Default ₹50,000
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [activateStartDate, setActivateStartDate] = useState<string>('');
  const [activateEndDate, setActivateEndDate] = useState<string>('');
  const [activateError, setActivateError] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const canDeleteCompany = currentUser?.role === 'ADMIN';
  const isAggregatorView = currentUser?.role === 'AGGREGATOR';

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const [companyData, docsData, complianceData, paymentData, bookingsData] =
        await Promise.all([
          getCompany(companyId),
          listCompanyDocuments(companyId),
          getComplianceStatus(companyId).catch(() => null),
          getCompanyPaymentHistory(companyId).catch(() => null),
          listCompanyBookings(companyId).catch(() => [] as AggregatorBooking[]),
        ]);
      setCompany(companyData);
      setDocuments(Array.isArray(docsData) ? docsData : []);
      setCompliance(complianceData);
      setPaymentHistory(paymentData);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company');
      setCompany(null);
      setDocuments([]);
      setCompliance(null);
      setPaymentHistory(null);
      setBookings(null);
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
      await downloadDocumentFile(docId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function handleView(docId: string, fileName: string) {
    setViewerOpen(true);
    setViewerFileUrl(null);
    setViewerFileName(fileName);
    setViewerLoading(true);
    try {
      const { fileUrl } = await getDocumentViewUrl(docId);
      setViewerFileUrl(fileUrl);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load document');
      setViewerOpen(false);
    } finally {
      setViewerLoading(false);
    }
  }

  async function handleNotifyAgreementDraftShared(documentId: string) {
    if (!companyId) return;
    setNotifyDraftError(null);
    setNotifyDraftSuccess(null);
    setNotifyDraftBusyId(documentId);
    try {
      const res = await notifyAgreementDraftShared(documentId);
      setNotifyDraftSuccess(
        res.message || 'Client notified. Stage advanced to "Agreement draft shared".',
      );
      await loadData();
    } catch (err) {
      setNotifyDraftError(
        err instanceof Error ? err.message : 'Failed to notify client about the agreement draft',
      );
    } finally {
      setNotifyDraftBusyId(null);
    }
  }

  async function handleUploadAggregatorSignedAgreement() {
    if (!companyId || !aggregatorSignedFile) return;
    setAggregatorSignedError(null);
    setAggregatorSignedSuccess(null);
    setAggregatorSignedUploading(true);
    try {
      const res = await uploadAggregatorSignedAgreement(companyId, aggregatorSignedFile);
      setAggregatorSignedSuccess(
        `Signed agreement uploaded (v${res.version}, ${res.fileName}). Stage moved to "Signed Agreement Received" for admin review.`,
      );
      setAggregatorSignedFile(null);
      await loadData();
    } catch (err) {
      setAggregatorSignedError(
        err instanceof Error ? err.message : 'Failed to upload signed agreement',
      );
    } finally {
      setAggregatorSignedUploading(false);
    }
  }

  async function handleGenerateAgreementDraftFromTemplate() {
    if (!companyId) return;
    setAgreementDraftError(null);
    setTemplateDraftSuccess(null);
    setTemplateDraftGenerating(true);
    try {
      const res = await generateAgreementDraftFromTemplate(companyId);
      setTemplateDraftSuccess(
        `Generated draft v${res.version} (${res.fileName}). Review it below, then click "Notify draft shared".`,
      );
      await loadData();
    } catch (err) {
      setAgreementDraftError(
        err instanceof Error ? err.message : 'Failed to generate draft from template',
      );
    } finally {
      setTemplateDraftGenerating(false);
    }
  }

  async function handleUploadAgreementDraft() {
    if (!companyId || agreementDraftFiles.length === 0) return;
    setAgreementDraftError(null);
    setAgreementDraftUploading(true);
    try {
      for (const file of agreementDraftFiles) {
        await uploadAgreementDraft(companyId, file);
      }
      setAgreementDraftFiles([]);
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
      await uploadFinalAgreement(companyId, finalAgreementFile, selectedFinalDocType);
      setFinalAgreementFile(null);
      await loadData();
    } catch (err) {
      setFinalAgreementError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setFinalAgreementUploading(false);
    }
  }

  async function handleGeneratePaymentLink() {
    if (!companyId) return;
    const amount = Number.parseFloat(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setActionError('Please enter a valid amount (e.g. 50000 for ₹50,000)');
      return;
    }
    setActionError(null);
    setPaymentCreating(true);
    try {
      await createPayment({ companyId, amount, currency: 'INR' });
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setPaymentCreating(false);
    }
  }

  async function handleCopyPaymentLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setActionError(null);
    } catch (err) {
      setActionError('Failed to copy to clipboard');
    }
  }

  async function handleResendPaymentLink(paymentId: string) {
    setActionError(null);
    setPaymentResending(paymentId);
    try {
      await resendPaymentLink(paymentId);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resend payment link');
    } finally {
      setPaymentResending(null);
    }
  }

  async function handleResendInvite() {
    if (!companyId) return;
    setActionError(null);
    setResendInviteBusy(true);
    try {
      const result = await resendInvite(companyId);
      setInviteSentBanner(result.sent);
      if (!result.sent) {
        setActionError(result.message);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to resend invite');
    } finally {
      setResendInviteBusy(false);
    }
  }

  async function handleMarkAsPaid(paymentId: string) {
    if (!window.confirm('Mark this payment as paid? This will update the company stage and generate an invoice.'))
      return;
    setActionError(null);
    setMarkPaidBusy(paymentId);
    try {
      await markPaymentAsPaid(paymentId);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark payment as paid');
    } finally {
      setMarkPaidBusy(null);
    }
  }

  const isAlreadyActive =
    company?.onboardingStage === 'ACTIVE' || company?.onboardingStage === 'COMPLETED';
  const canActivate = company?.onboardingStage === 'FINAL_AGREEMENT_SHARED';
  const isKycReviewStage = company?.onboardingStage === 'KYC_REVIEW';
  const canMarkKycComplete = isKycReviewStage && compliance?.isCompliant === true;
  const isAggregator = company?.clientChannel === 'AGGREGATOR';
  const showPaymentSection =
    !isAggregator &&
    (company?.onboardingStage === 'ADMIN_CREATED' ||
      company?.onboardingStage === 'PAYMENT_PENDING');
  const pendingPayment = paymentHistory?.payments?.find((p) => p.status === 'CREATED');
  const paidPayment = paymentHistory?.payments?.find((p) => p.status === 'PAID');
  const latestPayment = paymentHistory?.payments?.[0]; // Most recent first

  async function handleMarkKycComplete() {
    if (!companyId || !canMarkKycComplete) return;
    if (!window.confirm('Mark KYC review as complete and move to Agreement draft stage?')) return;
    setActionError(null);
    setKycCompleteBusy(true);
    try {
      await updateCompanyStage(companyId, 'AGREEMENT_DRAFT_SHARED');
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update stage');
    } finally {
      setKycCompleteBusy(false);
    }
  }

  function openActivateModal() {
    if (!canActivate) return;
    setActivateError(null);
    setActivateStartDate('');
    setActivateEndDate('');
    setActivateModalOpen(true);
  }

  async function handleActivateSubmit() {
    if (!companyId || !canActivate) return;
    setActivateError(null);

    if (isAggregator) {
      if (!activateStartDate || !activateEndDate) {
        setActivateError('Contract start and end dates are required to activate an aggregator company.');
        return;
      }
    }
    if (activateStartDate && activateEndDate) {
      const start = new Date(activateStartDate);
      const end = new Date(activateEndDate);
      if (!(end.getTime() > start.getTime())) {
        setActivateError('Contract end date must be after contract start date.');
        return;
      }
    }

    setActionError(null);
    setActivateBusy(true);
    try {
      await activateCompany(companyId, {
        contractStartDate: activateStartDate || undefined,
        contractEndDate: activateEndDate || undefined,
      });
      setActivateModalOpen(false);
      await loadData();
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActivateBusy(false);
    }
  }

  async function handleDeleteCompany() {
    if (!companyId || !company) return;
    if (
      !window.confirm(
        `Delete "${company.companyName}"? This will permanently remove the company, its users, documents, invoices, and all associated data. This cannot be undone.`,
      )
    )
      return;
    setActionError(null);
    setDeleteBusy(true);
    try {
      await deleteCompany(companyId);
      navigate('/admin/dashboard');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete company');
    } finally {
      setDeleteBusy(false);
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

  function renderDocumentSection(title: string, sectionDocs: AdminDocumentListItem[]) {
    if (sectionDocs.length === 0) return null;
    // Context used by the aggregator-only "Notify draft shared" action below.
    // We enable the action on the latest AGREEMENT_DRAFT row only, and only
    // while the company stage is one that `onAgreementDraftShared` accepts
    // (KYC_REVIEW -> AGREEMENT_DRAFT_SHARED, or already at AGREEMENT_DRAFT_SHARED).
    const isAggregatorCompany = company?.clientChannel === 'AGGREGATOR';
    const notifyAllowedStages = new Set(['KYC_REVIEW', 'AGREEMENT_DRAFT_SHARED']);
    const notifyStageAllowed = !!company?.onboardingStage && notifyAllowedStages.has(company.onboardingStage);
    const latestAgreementDraftId = sectionDocs
      .filter((d) => d.documentType === 'AGREEMENT_DRAFT')
      .reduce<{ id: string; version: number } | null>((acc, d) => {
        const v = d.version ?? 0;
        if (!acc || v > acc.version) return { id: d.id, version: v };
        return acc;
      }, null)?.id ?? null;
    return (
      <div key={title} style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
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
            {sectionDocs.map((doc) => (
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
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => handleView(doc.id, doc.fileName)}
                      className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-xs hover:bg-background"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-xs hover:bg-background"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                    {!isAggregatorView && isReviewable(doc.status) && (
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
                    {!isAggregatorView &&
                      isAggregatorCompany &&
                      doc.documentType === 'AGREEMENT_DRAFT' &&
                      doc.id === latestAgreementDraftId &&
                      (() => {
                        const alreadyNotified = company?.onboardingStage === 'AGREEMENT_DRAFT_SHARED';
                        const stageBlocked = !notifyStageAllowed;
                        const busy = notifyDraftBusyId !== null;
                        const disabled = busy || stageBlocked;
                        const label = notifyDraftBusyId === doc.id
                          ? 'Notifying\u2026'
                          : alreadyNotified
                          ? 'Re-notify draft shared'
                          : 'Notify draft shared';
                        const tooltip = stageBlocked
                          ? 'Draft can only be notified while the stage is "KYC review" or "Agreement draft shared".'
                          : alreadyNotified
                          ? 'Resend the agreement draft email to the client with the latest draft.'
                          : 'Email this draft to the client and advance the stage to "Agreement draft shared".';
                        return (
                          <button
                            type="button"
                            onClick={() => handleNotifyAgreementDraftShared(doc.id)}
                            disabled={disabled}
                            title={tooltip}
                            style={{
                              backgroundColor: disabled ? '#9e9e9e' : '#1565c0',
                              color: '#fff',
                              border: `1px solid ${disabled ? '#9e9e9e' : '#1565c0'}`,
                              cursor: disabled ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" onClick={() => navigate('/admin/dashboard')}>
          ← Back to dashboard
        </button>
        {canDeleteCompany && (
          <button
            type="button"
            onClick={handleDeleteCompany}
            disabled={deleteBusy}
            style={{
              backgroundColor: '#c62828',
              color: '#fff',
              border: '1px solid #c62828',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              cursor: deleteBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {deleteBusy ? 'Deleting…' : 'Delete company'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Company review</h1>
        <span
          style={{
            padding: '0.25rem 0.65rem',
            borderRadius: 999,
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: 0.3,
            backgroundColor: isAggregator ? '#fef3c7' : '#e0f2fe',
            color: isAggregator ? '#92400e' : '#075985',
            border: `1px solid ${isAggregator ? '#fde68a' : '#bae6fd'}`,
          }}
          title={isAggregator ? 'Aggregator client (payment handled externally)' : 'Direct client (standard flow)'}
        >
          {isAggregator
            ? `AGGREGATOR${company.aggregatorName ? `: ${company.aggregatorName}` : ''}`
            : 'DIRECT'}
        </span>
      </div>

      {(company.contractStartDate || company.contractEndDate) && (
        <p style={{ marginTop: '0.25rem', color: '#475569', fontSize: '0.875rem' }}>
          Contract:{' '}
          <strong>{company.contractStartDate ? formatDate(company.contractStartDate) : '—'}</strong>
          {' to '}
          <strong>{company.contractEndDate ? formatDate(company.contractEndDate) : '—'}</strong>
        </p>
      )}

      {isAggregator && bookings && bookings.length > 0 && (
        <BookingDetailsCard bookings={bookings} />
      )}

      {/* Visual onboarding progress stepper */}
      <section style={{ marginTop: '1rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.125rem' }}>Onboarding progress</h2>
        <OnboardingStepper
          stage={company.onboardingStage}
          showPercentage
          clientChannel={company.clientChannel ?? null}
          view={isAggregatorView ? 'aggregator' : 'admin'}
        />
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
          {ONBOARDING_STAGE_ORDER.map((s) => {
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

      {(inviteSentBanner || inviteSentFromCreate) && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '0.75rem 1rem',
            backgroundColor: '#e8f5e9',
            border: '1px solid #81c784',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontWeight: 500 }}>Invite email sent to client. They can set their password and log in.</span>
          <button
            type="button"
            onClick={() => {
              setInviteSentBanner(false);
              navigate(location.pathname, { replace: true }); // Clear location state
            }}
            style={{ fontSize: '0.875rem', color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Company profile</h2>
        <p><strong>Company name:</strong> {company.companyName}</p>
        <p><strong>Contact email:</strong> {company.contactEmail}</p>
        {(company.onboardingStage === 'ADMIN_CREATED' || company.onboardingStage === 'PAYMENT_PENDING') && (
          <p style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={handleResendInvite}
              disabled={resendInviteBusy}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                backgroundColor: '#1565c0',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: resendInviteBusy ? 'not-allowed' : 'pointer',
              }}
            >
              {resendInviteBusy ? 'Sending…' : 'Resend Invite'}
            </button>
          </p>
        )}
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
        {canMarkKycComplete && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#e8f5e9', borderRadius: 6, border: '1px solid #81c784' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
              All KYC documents approved. Click below to mark KYC review complete and move to Agreement draft stage.
            </p>
            <button
              type="button"
              onClick={handleMarkKycComplete}
              disabled={kycCompleteBusy}
              style={{ backgroundColor: '#2e7d32', color: '#fff', padding: '0.5rem 1rem', border: 'none', borderRadius: 4, fontWeight: 600 }}
            >
              {kycCompleteBusy ? 'Updating…' : 'Mark KYC Review Complete'}
            </button>
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          {isAlreadyActive ? (
            <button
              type="button"
              disabled
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '1rem',
                fontWeight: 700,
                backgroundColor: '#2e7d32',
                color: '#fff',
                border: '2px solid #2e7d32',
                borderRadius: 6,
                cursor: 'default',
              }}
            >
              ✓ Company Activated
            </button>
          ) : (
            <button
              type="button"
              onClick={openActivateModal}
              disabled={!canActivate || activateBusy}
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '1rem',
                fontWeight: 700,
                backgroundColor: canActivate ? (activateBusy ? '#1976d2' : '#1565c0') : '#9e9e9e',
                color: '#fff',
                border: `2px solid ${canActivate ? (activateBusy ? '#1976d2' : '#1565c0') : '#9e9e9e'}`,
                borderRadius: 6,
                cursor: canActivate && !activateBusy ? 'pointer' : 'not-allowed',
              }}
            >
              {activateBusy ? 'Activating…' : 'Activate Company'}
            </button>
          )}
          {!canActivate && !isAlreadyActive && (
            <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.875rem' }}>
              Activate only when stage is &quot;Final agreement shared&quot;.
            </p>
          )}
        </div>
      </section>

      {showPaymentSection && (
        <section
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: 8,
            border: '1px solid #1565c0',
            backgroundColor: '#e3f2fd',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Payment</h2>
          {!pendingPayment && !paidPayment && (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="payment-amount" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}>
                Amount (₹)
              </label>
              <input
                id="payment-amount"
                type="number"
                min={1}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                disabled={paymentCreating}
                style={{ padding: '0.5rem', width: '12rem', marginRight: '0.5rem' }}
              />
              <button
                type="button"
                onClick={handleGeneratePaymentLink}
                disabled={paymentCreating}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#1565c0',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontWeight: 600,
                  cursor: paymentCreating ? 'not-allowed' : 'pointer',
                }}
              >
                {paymentCreating ? 'Generating…' : 'Generate Payment Link'}
              </button>
            </div>
          )}
          {latestPayment && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem', marginBottom: '0.5rem' }}>
              <Badge
                variant={
                  latestPayment.status === 'PAID'
                    ? 'approved'
                    : latestPayment.status === 'FAILED'
                      ? 'rejected'
                      : 'pending'
                }
              >
                {latestPayment.status === 'CREATED' ? 'Link created' : latestPayment.status === 'PAID' ? 'Paid' : 'Failed'}
              </Badge>
              {latestPayment.paidAt && (
                <span style={{ fontSize: '0.875rem', color: '#555' }}>
                  Paid on {formatDate(latestPayment.paidAt)}
                </span>
              )}
              <span style={{ fontSize: '0.875rem' }}>
                ₹{latestPayment.amount.toLocaleString('en-IN')} {latestPayment.currency}
              </span>
            </div>
          )}
          {pendingPayment?.paymentLink && (
            <div style={{ marginTop: '0.75rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Payment link</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  readOnly
                  value={pendingPayment.paymentLink}
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #bbb',
                    borderRadius: 4,
                  }}
                />
                <button type="button" onClick={() => handleCopyPaymentLink(pendingPayment.paymentLink!)}>
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => handleResendPaymentLink(pendingPayment.id)}
                  disabled={paymentResending === pendingPayment.id}
                >
                  {paymentResending === pendingPayment.id ? 'Sending…' : 'Send to client'}
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkAsPaid(pendingPayment.id)}
                  disabled={markPaidBusy === pendingPayment.id}
                  style={{
                    backgroundColor: '#2e7d32',
                    color: '#fff',
                    border: '1px solid #2e7d32',
                    padding: '0.35rem 0.6rem',
                    borderRadius: 4,
                    cursor: markPaidBusy === pendingPayment.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {markPaidBusy === pendingPayment.id ? 'Updating…' : 'Mark as paid'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Documents</h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#555' }}>
          {isAggregatorView
            ? 'Download or view any uploaded document. Once Aspire admins share the agreement draft, upload the client-signed copy below.'
            : 'Download any file; use Approve / Reject / Pending with client for documents awaiting review.'}
        </p>
        {isAggregatorView && company?.clientChannel === 'AGGREGATOR' && (() => {
          const stage = company?.onboardingStage;
          const canUpload =
            stage === 'AGREEMENT_DRAFT_SHARED' || stage === 'SIGNED_AGREEMENT_RECEIVED';
          const alreadyReceived = stage === 'SIGNED_AGREEMENT_RECEIVED';
          const latestSigned = documents
            .filter((d) => d.documentType === 'AGREEMENT_SIGNED')
            .reduce<{ fileName: string; version: number | null } | null>((acc, d) => {
              const v = d.version ?? 0;
              if (!acc || v > (acc.version ?? 0)) {
                return { fileName: d.fileName, version: d.version ?? null };
              }
              return acc;
            }, null);
          if (!canUpload) {
            // Once the stage has progressed past SIGNED_AGREEMENT_RECEIVED (Final
            // Agreement Shared / Active / Completed), the card is read-only and
            // simply confirms the upload already happened. Before draft shared,
            // we don't render the card at all so the aggregator sees a cleaner
            // page.
            if (stage && ['FINAL_AGREEMENT_SHARED', 'ACTIVE', 'COMPLETED'].includes(stage)) {
              return (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    border: '1px solid #c7d2fe',
                    borderRadius: 4,
                    backgroundColor: '#eef2ff',
                  }}
                >
                  <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#1e3a8a' }}>
                    Signed agreement already received
                  </h3>
                  {latestSigned && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#1e3a8a' }}>
                      Latest on file: {latestSigned.fileName}
                      {latestSigned.version != null ? ` (v${latestSigned.version})` : ''}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }
          return (
            <div
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                border: '1px solid #0f766e',
                borderRadius: 4,
                backgroundColor: '#ecfdf5',
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#064e3b' }}>
                Upload signed agreement
              </h3>
              <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: '#065f46' }}>
                {alreadyReceived
                  ? 'A signed copy is already on record. Uploading a new file will replace it with a new version and re-send the confirmation email.'
                  : 'Upload the scanned signed agreement from your client. This moves the onboarding to "Signed Agreement Received" for admin\u2019s final review.'}
                {' '}Supports .pdf, .doc, .docx (max 10MB).
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setAggregatorSignedFile(e.target.files?.[0] ?? null)}
                  disabled={aggregatorSignedUploading}
                />
                <button
                  type="button"
                  onClick={handleUploadAggregatorSignedAgreement}
                  disabled={!aggregatorSignedFile || aggregatorSignedUploading}
                  style={{
                    background: !aggregatorSignedFile || aggregatorSignedUploading ? '#e5e7eb' : '#0f766e',
                    color: !aggregatorSignedFile || aggregatorSignedUploading ? '#6b7280' : '#fff',
                    border: '1px solid ' + (!aggregatorSignedFile || aggregatorSignedUploading ? '#d1d5db' : '#0f766e'),
                    borderRadius: 4,
                    padding: '0.4rem 0.8rem',
                    cursor: !aggregatorSignedFile || aggregatorSignedUploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {aggregatorSignedUploading
                    ? 'Uploading\u2026'
                    : alreadyReceived
                    ? 'Upload new version'
                    : 'Upload signed agreement'}
                </button>
              </div>
              {aggregatorSignedFile && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#065f46' }}>
                  Selected: {aggregatorSignedFile.name}
                </p>
              )}
              {latestSigned && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#065f46' }}>
                  Latest on file: {latestSigned.fileName}
                  {latestSigned.version != null ? ` (v${latestSigned.version})` : ''}
                </p>
              )}
              {aggregatorSignedSuccess && (
                <p style={{ color: '#065f46', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {aggregatorSignedSuccess}
                </p>
              )}
              {aggregatorSignedError && (
                <p style={{ color: 'crimson', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {aggregatorSignedError}
                </p>
              )}
            </div>
          );
        })()}
        {!isAggregatorView && (
        <>
        <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 4 }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Upload agreement draft(s)</h3>
          <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: '#666' }}>
            Upload one or more draft agreements. The client will be notified by email. Supports .pdf, .doc, .docx.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              onChange={(e) => setAgreementDraftFiles(Array.from(e.target.files ?? []))}
              disabled={agreementDraftUploading}
            />
            <button
              type="button"
              onClick={handleUploadAgreementDraft}
              disabled={agreementDraftFiles.length === 0 || agreementDraftUploading}
            >
              {agreementDraftUploading ? 'Uploading…' : (agreementDraftFiles.length > 0 ? `Upload ${agreementDraftFiles.length} file(s)` : 'Upload and notify client')}
            </button>
            {company?.clientChannel === 'AGGREGATOR' && (() => {
              const SUPPORTED_TEMPLATE_PLANS = ['GR', 'BR'] as const;
              // Aggregator drafts are rendered from registration data, so the
              // button is enabled at every pre-signing stage. Once the client
              // has signed / completed / is rejected, generation is blocked.
              const BLOCKED_TEMPLATE_STAGES = [
                'SIGNED_AGREEMENT_RECEIVED',
                'FINAL_AGREEMENT_SHARED',
                'ACTIVE',
                'COMPLETED',
                'REJECTED',
              ] as const;
              const latestBooking = bookings && bookings.length > 0 ? bookings[0] : null;
              const planType = latestBooking?.planType ?? null;
              const stage = company?.onboardingStage;
              const planSupported =
                planType !== null &&
                (SUPPORTED_TEMPLATE_PLANS as readonly string[]).includes(planType);
              const stageBlocked =
                !!stage &&
                (BLOCKED_TEMPLATE_STAGES as readonly string[]).includes(stage);
              const hasBooking = !!latestBooking;
              let tooltip = `Render the ${planType ?? ''} Leave & License template with this client\u2019s data in one click. Review before notifying the client.`;
              if (!hasBooking) {
                tooltip = 'No aggregator booking found for this client.';
              } else if (!planSupported) {
                tooltip = `Template available for plan types: ${SUPPORTED_TEMPLATE_PLANS.join(', ')} (current: ${planType ?? 'not set'}). Upload manually or switch to a supported plan.`;
              } else if (stageBlocked) {
                tooltip = 'Agreement draft can no longer be generated: the client has already signed or completed the agreement.';
              }
              const disabled =
                templateDraftGenerating || agreementDraftUploading || !hasBooking || !planSupported || stageBlocked;
              const buttonLabel = templateDraftGenerating
                ? 'Generating\u2026'
                : planSupported
                ? `Generate draft from template (${planType})`
                : 'Generate draft from template';
              return (
                <button
                  type="button"
                  onClick={handleGenerateAgreementDraftFromTemplate}
                  disabled={disabled}
                  title={tooltip}
                  style={{
                    background: disabled ? '#e5e7eb' : '#0f766e',
                    color: disabled ? '#6b7280' : '#fff',
                    border: '1px solid ' + (disabled ? '#d1d5db' : '#0f766e'),
                    borderRadius: 4,
                    padding: '0.4rem 0.8rem',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {buttonLabel}
                </button>
              );
            })()}
          </div>
          {company?.clientChannel === 'AGGREGATOR' && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#0f766e' }}>
              Aggregator client: you can auto-generate the Leave &amp; License draft (GR or BR)
              from the packaged template as soon as the client is registered &mdash; the draft
              is populated from the registration &amp; booking signatory details. Click
              &ldquo;Notify draft shared&rdquo; after KYC is approved to email the client.
            </p>
          )}
          {agreementDraftFiles.length > 0 && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
              Selected: {agreementDraftFiles.map((f) => f.name).join(', ')}
            </p>
          )}
          {templateDraftSuccess && (
            <p style={{ color: '#065f46', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {templateDraftSuccess}
            </p>
          )}
          {notifyDraftSuccess && (
            <p style={{ color: '#065f46', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {notifyDraftSuccess}
            </p>
          )}
          {notifyDraftError && (
            <p style={{ color: 'crimson', fontSize: '0.875rem', marginTop: '0.5rem' }}>{notifyDraftError}</p>
          )}
          {agreementDraftError && (
            <p style={{ color: 'crimson', fontSize: '0.875rem', marginTop: '0.5rem' }}>{agreementDraftError}</p>
          )}
        </div>
        <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #1565c0', borderRadius: 4, backgroundColor: '#e3f2fd' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Upload post-agreement documents</h3>
          <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: '#666' }}>
            Choose document type, then select a file. Only &quot;Final Agreement&quot; triggers client email and stage change to &quot;Final agreement shared&quot;.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={selectedFinalDocType}
              onChange={(e) => setSelectedFinalDocType(e.target.value as AdminPostAgreementDocumentType)}
              style={{ padding: '0.35rem 0.5rem', minWidth: 180 }}
            >
              {POST_AGREEMENT_DOC_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
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
              {finalAgreementUploading ? 'Uploading…' : selectedFinalDocType === 'AGREEMENT_FINAL' ? 'Upload and notify client' : 'Upload'}
            </button>
          </div>
          {finalAgreementError && (
            <p style={{ color: 'crimson', fontSize: '0.875rem', marginTop: '0.5rem' }}>{finalAgreementError}</p>
          )}
        </div>
        </>
        )}
        {actionError && (
          <p style={{ color: 'crimson', marginBottom: '0.5rem' }}>{actionError}</p>
        )}
        {documents.length === 0 ? (
          <p>No documents.</p>
        ) : (
          <>
            {renderDocumentSection('KYC Documents', documents.filter((d) => !['AGREEMENT_DRAFT', 'AGREEMENT_SIGNED', 'AGREEMENT_FINAL', 'NOC_ASPIRE_COWORKS', 'NOC_LANDLORD', 'ELECTRICITY_BILL', 'WIFI_BILL'].includes(d.documentType)))}
            {renderDocumentSection('Agreement draft', documents.filter((d) => d.documentType === 'AGREEMENT_DRAFT'))}
            {renderDocumentSection('Signed agreement', documents.filter((d) => d.documentType === 'AGREEMENT_SIGNED'))}
            {renderDocumentSection('Final Agreement', documents.filter((d) => d.documentType === 'AGREEMENT_FINAL'))}
            {renderDocumentSection('NOC from Aspire Coworks', documents.filter((d) => d.documentType === 'NOC_ASPIRE_COWORKS'))}
            {renderDocumentSection('NOC from Landlord', documents.filter((d) => d.documentType === 'NOC_LANDLORD'))}
            {renderDocumentSection('Electricity Bill', documents.filter((d) => d.documentType === 'ELECTRICITY_BILL'))}
            {renderDocumentSection('Wifi Bill', documents.filter((d) => d.documentType === 'WIFI_BILL'))}
          </>
        )}
      </section>

      <DocumentViewer
        fileUrl={viewerFileUrl}
        fileName={viewerFileName}
        isOpen={viewerOpen}
        onClose={() => {
          if (viewerFileUrl?.startsWith('blob:')) URL.revokeObjectURL(viewerFileUrl);
          setViewerOpen(false);
          setViewerFileUrl(null);
        }}
        loadingUrl={viewerLoading}
        onDownload={
          viewerFileUrl
            ? () => {
                const a = document.createElement('a');
                a.href = viewerFileUrl;
                a.download = viewerFileName || 'document';
                a.click();
              }
            : undefined
        }
      />

      {activateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => {
            if (!activateBusy) setActivateModalOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '1.5rem',
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Activate {company.companyName}</h2>
            <p style={{ margin: '0.5rem 0 1rem', color: '#475569', fontSize: '0.9rem' }}>
              {isAggregator
                ? 'Enter the contract period. Both dates are required for aggregator clients.'
                : 'Optionally enter a contract period. Leave blank to use the existing flow.'}
            </p>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Contract start date{isAggregator ? ' *' : ''}
                </span>
                <input
                  type="date"
                  value={activateStartDate}
                  onChange={(e) => setActivateStartDate(e.target.value)}
                  disabled={activateBusy}
                  required={isAggregator}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Contract end date{isAggregator ? ' *' : ''}
                </span>
                <input
                  type="date"
                  value={activateEndDate}
                  onChange={(e) => setActivateEndDate(e.target.value)}
                  disabled={activateBusy}
                  required={isAggregator}
                  min={activateStartDate || undefined}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                  }}
                />
              </label>
            </div>

            {activateError && (
              <p style={{ color: 'crimson', fontSize: '0.85rem', marginTop: '0.75rem' }}>{activateError}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setActivateModalOpen(false)}
                disabled={activateBusy}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  cursor: activateBusy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivateSubmit}
                disabled={activateBusy}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  border: '1px solid #1565c0',
                  background: '#1565c0',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: activateBusy ? 'not-allowed' : 'pointer',
                }}
              >
                {activateBusy ? 'Activating…' : 'Confirm activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Read-only booking card for aggregator-channel clients. Shows all fields submitted by the
 *  aggregator at registration, including the Invoice-To snapshot – so admins raising the invoice
 *  see exactly what was requested. Renders nothing if the bookings array is empty. */
/** Mask all but the last 4 digits of an Aadhaar number for display. */
function maskAadhaar(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return value;
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

function BookingDetailsCard({ bookings }: { bookings: AggregatorBooking[] }) {
  return (
    <section
      style={{
        marginTop: '1.5rem',
        border: '1px solid #fde68a',
        background: '#fffbeb',
        borderRadius: 8,
        padding: '1rem 1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#92400e' }}>Booking details</h2>
        <span style={{ fontSize: '0.75rem', color: '#92400e' }}>
          Submitted by the aggregator at client registration.
        </span>
      </div>

      {bookings.map((b, idx) => (
        <div
          key={b.id}
          style={{
            marginTop: idx === 0 ? '0.75rem' : '1rem',
            borderTop: idx === 0 ? 'none' : '1px dashed #fcd34d',
            paddingTop: idx === 0 ? 0 : '0.85rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.6rem 1.25rem',
              fontSize: '0.88rem',
              color: '#0f172a',
            }}
          >
            <BookingField label="Booking ID" value={b.bookingReference} />
            <BookingField label="Plan type" value={b.planType} />
            <BookingField label="Venue" value={b.venueName} />
            <BookingField
              label="Duration"
              value={b.durationMonths != null ? `${b.durationMonths} month${b.durationMonths === 1 ? '' : 's'}` : null}
            />
            <BookingField
              label="Amount"
              value={
                b.amount != null
                  ? `${b.currency ?? 'INR'} ${b.amount}${b.gstApplicable ? ' + GST' : ''}`
                  : null
              }
            />
            <BookingField label="Client contact" value={b.clientContactName} />
            <BookingField label="POC" value={b.pocName} />
            <BookingField label="POC contact" value={b.pocContact} />
            <BookingField
              label="Father / spouse name"
              value={b.clientFatherOrSpouseName}
            />
            <BookingField label="Client PAN" value={b.clientPan} />
            <BookingField label="Client Aadhaar" value={maskAadhaar(b.clientAadhaar)} />
          </div>

          {b.venueAddress && (
            <div style={{ marginTop: '0.65rem', fontSize: '0.85rem', color: '#334155' }}>
              <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Venue address
              </div>
              <div style={{ whiteSpace: 'pre-line' }}>{b.venueAddress}</div>
            </div>
          )}

          {(b.paymentTerms || b.signageTerms) && (
            <div
              style={{
                marginTop: '0.65rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.85rem',
                color: '#334155',
              }}
            >
              {b.paymentTerms && (
                <div>
                  <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Payment terms
                  </div>
                  <div style={{ whiteSpace: 'pre-line' }}>{b.paymentTerms}</div>
                </div>
              )}
              {b.signageTerms && (
                <div>
                  <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Signage terms
                  </div>
                  <div style={{ whiteSpace: 'pre-line' }}>{b.signageTerms}</div>
                </div>
              )}
            </div>
          )}

          {(b.invoiceLegalName ||
            b.invoiceGstin ||
            b.invoicePan ||
            b.invoiceConstitution ||
            b.invoiceRegisteredAddress) && (
            <div
              style={{
                marginTop: '0.85rem',
                borderTop: '1px dashed #fde68a',
                paddingTop: '0.75rem',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: '#92400e',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: '0.35rem',
                }}
              >
                Invoice to
              </div>
              <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>
                {b.invoiceLegalName ?? '—'}
              </div>
              {b.invoiceConstitution && (
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {b.invoiceConstitution}
                </div>
              )}
              {(b.invoiceGstin || b.invoicePan) && (
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
                  {b.invoiceGstin && (
                    <>
                      GSTIN: <strong>{b.invoiceGstin}</strong>
                    </>
                  )}
                  {b.invoiceGstin && b.invoicePan && <span>{' · '}</span>}
                  {b.invoicePan && (
                    <>
                      PAN: <strong>{b.invoicePan}</strong>
                    </>
                  )}
                </div>
              )}
              {b.invoiceRegisteredAddress && (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: '#475569',
                    marginTop: '0.25rem',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {b.invoiceRegisteredAddress}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function BookingField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div
        style={{
          fontWeight: 600,
          color: '#92400e',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      <div style={{ color: '#0f172a', fontSize: '0.9rem' }}>{value || '—'}</div>
    </div>
  );
}
