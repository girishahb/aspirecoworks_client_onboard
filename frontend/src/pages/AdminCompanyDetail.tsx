import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
import DocumentViewer from '../components/DocumentViewer';
import CompanyReviewTabList from '../components/company-detail/CompanyReviewTabList';
import CompanyReviewSkeleton from '../components/company-detail/CompanyReviewSkeleton';
import CompanyReviewOverviewTab from '../components/company-detail/CompanyReviewOverviewTab';
import CompanyReviewDocumentsTab from '../components/company-detail/CompanyReviewDocumentsTab';
import CompanyReviewAgreementTab from '../components/company-detail/CompanyReviewAgreementTab';
import CompanyReviewActionsTab from '../components/company-detail/CompanyReviewActionsTab';
import { parseTabParam, type CompanyReviewTabId } from '../components/company-detail/companyReviewTypes';
import { formatCompanyDate } from '../components/company-detail/formatting';

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
  const [paymentAmount, setPaymentAmount] = useState<string>('50000'); // Default â‚¹50,000
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [activateStartDate, setActivateStartDate] = useState<string>('');
  const [activateEndDate, setActivateEndDate] = useState<string>('');
  const [activateError, setActivateError] = useState<string | null>(null);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const canDeleteCompany = currentUser?.role === 'ADMIN';
  const isAggregatorView = currentUser?.role === 'AGGREGATOR';
  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardPath = isAggregatorView ? '/aggregator/dashboard' : '/admin/dashboard';

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
      setActionError('Please enter a valid amount (e.g. 50000 for â‚¹50,000)');
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
      navigate(dashboardPath);
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
        <button type="button" onClick={() => navigate(dashboardPath)}>
          Back to dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Company review</h1>
        <CompanyReviewSkeleton />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Company review</h1>
        <p className="text-red-700">{error ?? 'Company not found.'}</p>
        <button
          type="button"
          onClick={() => navigate(dashboardPath)}
          className="mt-2 text-sky-800 underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const activeTab: CompanyReviewTabId = parseTabParam(searchParams.get('tab'));
  const setActiveTab = (id: CompanyReviewTabId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', id);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(dashboardPath)}
          className="text-sm font-medium text-sky-800 hover:underline"
        >
          â† Back to dashboard
        </button>
        {canDeleteCompany && (
          <button
            type="button"
            onClick={handleDeleteCompany}
            disabled={deleteBusy}
            className="rounded-md border border-red-800 bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {deleteBusy ? 'Deletingâ€¦' : 'Delete company'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-semibold text-slate-900">Company review</h1>
        <span
          className={
            isAggregator
              ? 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900'
              : 'rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-sky-900'
          }
          title={isAggregator ? 'Aggregator client (payment handled externally)' : 'Direct client (standard flow)'}
        >
          {isAggregator ? `AGGREGATOR${company.aggregatorName ? `: ${company.aggregatorName}` : ''}` : 'DIRECT'}
        </span>
      </div>

      {(company.contractStartDate || company.contractEndDate) && (
        <p className="mt-2 text-sm text-slate-600">
          Contract:{' '}
          <strong>{company.contractStartDate ? formatCompanyDate(company.contractStartDate) : 'â€”'}</strong>
          {' to '}
          <strong>{company.contractEndDate ? formatCompanyDate(company.contractEndDate) : 'â€”'}</strong>
        </p>
      )}

      <CompanyReviewTabList activeTab={activeTab} onChange={setActiveTab} />

      {actionError && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>
      )}

      <div className="mt-6">
        {activeTab === 'overview' && (
          <CompanyReviewOverviewTab
            company={company}
            compliance={compliance}
            bookings={bookings}
            isAggregator={!!isAggregator}
            isAggregatorView={isAggregatorView}
            inviteSentBanner={inviteSentBanner}
            inviteSentFromCreate={inviteSentFromCreate}
            resendInviteBusy={resendInviteBusy}
            onResendInvite={handleResendInvite}
            onDismissInviteBanner={() => {
              setInviteSentBanner(false);
              navigate(location.pathname, { replace: true });
            }}
          />
        )}
        {activeTab === 'documents' && (
          <CompanyReviewDocumentsTab
            company={company}
            documents={documents}
            isAggregatorView={isAggregatorView}
            busyId={busyId}
            notifyDraftBusyId={notifyDraftBusyId}
            onView={handleView}
            onDownload={handleDownload}
            onApprove={handleApprove}
            onReject={handleReject}
            onMarkPendingWithClient={handleMarkPendingWithClient}
            onNotifyAgreementDraftShared={handleNotifyAgreementDraftShared}
          />
        )}
        {activeTab === 'agreements' && (
          <CompanyReviewAgreementTab
            company={company}
            documents={documents}
            isAggregatorView={isAggregatorView}
            bookings={bookings}
            agreementDraftFiles={agreementDraftFiles}
            setAgreementDraftFiles={setAgreementDraftFiles}
            agreementDraftUploading={agreementDraftUploading}
            agreementDraftError={agreementDraftError}
            templateDraftGenerating={templateDraftGenerating}
            templateDraftSuccess={templateDraftSuccess}
            notifyDraftSuccess={notifyDraftSuccess}
            notifyDraftError={notifyDraftError}
            aggregatorSignedFile={aggregatorSignedFile}
            setAggregatorSignedFile={setAggregatorSignedFile}
            aggregatorSignedUploading={aggregatorSignedUploading}
            aggregatorSignedSuccess={aggregatorSignedSuccess}
            aggregatorSignedError={aggregatorSignedError}
            finalAgreementFile={finalAgreementFile}
            setFinalAgreementFile={setFinalAgreementFile}
            selectedFinalDocType={selectedFinalDocType}
            setSelectedFinalDocType={setSelectedFinalDocType}
            finalAgreementUploading={finalAgreementUploading}
            finalAgreementError={finalAgreementError}
            onUploadAgreementDraft={handleUploadAgreementDraft}
            onGenerateTemplate={handleGenerateAgreementDraftFromTemplate}
            onUploadAggregatorSigned={handleUploadAggregatorSignedAgreement}
            onUploadFinalAgreement={handleUploadFinalAgreement}
          />
        )}
        {activeTab === 'actions' && (
          <CompanyReviewActionsTab
            isAggregatorView={isAggregatorView}
            showPaymentSection={showPaymentSection}
            canActivate={!!canActivate}
            isAlreadyActive={!!isAlreadyActive}
            canMarkKycComplete={!!canMarkKycComplete}
            activateBusy={activateBusy}
            kycCompleteBusy={kycCompleteBusy}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            paymentCreating={paymentCreating}
            paymentResending={paymentResending}
            markPaidBusy={markPaidBusy}
            paymentHistory={paymentHistory}
            onOpenActivateModal={openActivateModal}
            onMarkKycComplete={handleMarkKycComplete}
            onGeneratePaymentLink={handleGeneratePaymentLink}
            onCopyPaymentLink={handleCopyPaymentLink}
            onResendPaymentLink={handleResendPaymentLink}
            onMarkAsPaid={handleMarkAsPaid}
          />
        )}
      </div>

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
                {activateBusy ? 'Activatingâ€¦' : 'Confirm activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
