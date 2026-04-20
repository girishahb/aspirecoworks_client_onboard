import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  listMyDocuments,
  downloadDocumentFile,
  getDocumentViewUrl,
  uploadDocument,
  uploadSignedAgreement,
  submitKycForReview,
  type DocumentListItem,
  type DocumentType,
} from '../services/documents';
import { getMyCompany } from '../services/company';
import Badge from '../components/Badge';
import DocumentViewer from '../components/DocumentViewer';
import { Download, Upload, FileText, FileCheck, AlertCircle, Eye } from 'lucide-react';

/** KYC document types: Aadhaar, PAN, and Other for additional documents. */
const KYC_DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'OTHER', label: 'Other' },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function documentStatusVariant(status: string): 'approved' | 'rejected' | 'pending' {
  if (status === 'VERIFIED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
}

function documentStatusLabel(status: string): string {
  if (status === 'VERIFIED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'UPLOADED' || status === 'REVIEW_PENDING') return 'Under Review';
  if (status === 'PENDING_WITH_CLIENT') return 'Action Required';
  return 'Pending';
}

export default function ClientDocuments() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('AADHAAR');
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFileUrl, setViewerFileUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);

  // Multi-file upload (AGGREGATOR-friendly)
  type BulkItemStatus = 'pending' | 'uploading' | 'done' | 'error';
  interface BulkUploadItem {
    id: string;
    file: File;
    documentType: DocumentType;
    status: BulkItemStatus;
    progress: number;
    error?: string;
  }
  const [bulkItems, setBulkItems] = useState<BulkUploadItem[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [docs, comp] = await Promise.all([listMyDocuments(), getMyCompany()]);
      setDocuments(docs);
      setCompany(comp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(docId: string) {
    try {
      await downloadDocumentFile(docId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function handleView(docId: string, fileName: string) {
    setViewerLoading(true);
    setViewerOpen(true);
    setViewerFileUrl(null);
    setViewerFileName(fileName);
    try {
      const { fileUrl } = await getDocumentViewUrl(docId);
      setViewerFileUrl(fileUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load document');
      setViewerOpen(false);
    } finally {
      setViewerLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadDocument(selectedFile, documentType, (p) => setUploadProgress(p));
      setUploadSuccess('Document uploaded successfully');
      setSelectedFile(null);
      setDocumentType('AADHAAR');
      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function inferDocumentType(name: string): DocumentType {
    const lower = name.toLowerCase();
    if (lower.includes('aadhaar') || lower.includes('aadhar') || lower.includes('uidai')) return 'AADHAAR';
    if (lower.includes('pan')) return 'PAN';
    return 'OTHER';
  }

  function handleBulkFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadSuccess(null);
    const now = Date.now();
    const next: BulkUploadItem[] = Array.from(files).map((file, i) => ({
      id: `${now}-${i}-${file.name}`,
      file,
      documentType: inferDocumentType(file.name),
      status: 'pending',
      progress: 0,
    }));
    setBulkItems((prev) => [...prev, ...next]);
  }

  function updateBulkItem(id: string, patch: Partial<BulkUploadItem>) {
    setBulkItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeBulkItem(id: string) {
    setBulkItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleBulkUpload() {
    if (bulkItems.length === 0 || bulkUploading) return;
    setBulkUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    const pending = bulkItems.filter((it) => it.status === 'pending' || it.status === 'error');
    await Promise.all(
      pending.map(async (item) => {
        updateBulkItem(item.id, { status: 'uploading', progress: 0, error: undefined });
        try {
          await uploadDocument(item.file, item.documentType, (p) =>
            updateBulkItem(item.id, { progress: p }),
          );
          updateBulkItem(item.id, { status: 'done', progress: 100 });
        } catch (err) {
          updateBulkItem(item.id, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          });
        }
      }),
    );
    setBulkUploading(false);
    const hasErrors = bulkItems.some((it) => it.status === 'error');
    if (!hasErrors) {
      setUploadSuccess(`${pending.length} document${pending.length === 1 ? '' : 's'} uploaded.`);
    } else {
      setUploadError('Some uploads failed. Use Retry to try again.');
    }
    await loadData();
  }

  async function handleSubmitKycForReview() {
    if (submittingReview) return;
    setSubmitMessage(null);
    setUploadError(null);
    setSubmittingReview(true);
    try {
      await submitKycForReview();
      setSubmitMessage('KYC submitted for review. You will receive an email once the admin responds.');
      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to submit KYC for review');
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleUploadSignedAgreement(e: React.FormEvent) {
    e.preventDefault();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.doc,.docx';
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(true);
      setUploadProgress(0);
      try {
        await uploadSignedAgreement(file, (p) => setUploadProgress(p));
        setUploadSuccess('Signed agreement uploaded successfully');
        await loadData();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    };
    fileInput.click();
  }

  const kycDocuments = documents.filter(
    (d) =>
      ![
        'AGREEMENT_DRAFT',
        'AGREEMENT_SIGNED',
        'AGREEMENT_FINAL',
        'NOC_ASPIRE_COWORKS',
        'NOC_LANDLORD',
        'ELECTRICITY_BILL',
        'WIFI_BILL',
      ].includes(d.documentType),
  );

  /** Post-agreement document types (admin uploads; client can view/download). */
  const POST_AGREEMENT_DOC_TYPES: { type: string; label: string; emptyMessage: string }[] = [
    { type: 'AGREEMENT_FINAL', label: 'Final Agreement', emptyMessage: 'Your stamped final agreement will appear here once the admin shares it.' },
    { type: 'NOC_ASPIRE_COWORKS', label: 'NOC from Aspire Coworks', emptyMessage: 'No document uploaded yet.' },
    { type: 'NOC_LANDLORD', label: 'NOC from Landlord', emptyMessage: 'No document uploaded yet.' },
    { type: 'ELECTRICITY_BILL', label: 'Electricity Bill', emptyMessage: 'No document uploaded yet.' },
    { type: 'WIFI_BILL', label: 'Wifi Bill', emptyMessage: 'No document uploaded yet.' },
  ];

  const hasApprovedAadhaar = kycDocuments.some(
    (d) => d.documentType === 'AADHAAR' && d.status === 'VERIFIED',
  );
  const hasApprovedPan = kycDocuments.some(
    (d) => d.documentType === 'PAN' && d.status === 'VERIFIED',
  );
  const hasAadhaarPending = kycDocuments.some(
    (d) =>
      d.documentType === 'AADHAAR' &&
      ['UPLOADED', 'REVIEW_PENDING', 'PENDING_WITH_CLIENT'].includes(d.status),
  );
  const hasPanPending = kycDocuments.some(
    (d) =>
      d.documentType === 'PAN' &&
      ['UPLOADED', 'REVIEW_PENDING', 'PENDING_WITH_CLIENT'].includes(d.status),
  );
  const needsAadhaar = !hasApprovedAadhaar && !hasAadhaarPending;
  const needsPan = !hasApprovedPan && !hasPanPending;

  const canUploadKyc =
    company?.onboardingStage === 'KYC_IN_PROGRESS' ||
    company?.onboardingStage === 'KYC_REVIEW' ||
    company?.onboardingStage === 'PAYMENT_CONFIRMED';
  const agreementDraft = documents.find((d) => d.documentType === 'AGREEMENT_DRAFT');
  const hasSignedAgreement = documents.some((d) => d.documentType === 'AGREEMENT_SIGNED');
  const canUploadSigned =
    !hasSignedAgreement &&
    (company?.onboardingStage === 'AGREEMENT_DRAFT_SHARED' || !!agreementDraft);

  function openUploadForType(type: DocumentType) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSelectedFile(file);
        setDocumentType(type);
        document.getElementById('kyc-upload-form')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    input.click();
  }

  if (loading) {
    return (
      <div>
        <h1>Document Center</h1>
        <p>Loading documents…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1>Document Center</h1>
        <Link to="/dashboard" className="text-primary hover:text-accent">
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error bg-error/10 p-4 text-error">
          {error}
        </div>
      )}

      {/* KYC Documents Section */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            KYC Documents
          </h2>
          {canUploadKyc && (
            <div className="flex flex-wrap gap-2">
              {needsAadhaar && (
                <button
                  type="button"
                  onClick={() => openUploadForType('AADHAAR')}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  Upload Aadhaar
                </button>
              )}
              {needsPan && (
                <button
                  type="button"
                  onClick={() => openUploadForType('PAN')}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  Upload PAN
                </button>
              )}
              <button
                type="button"
                onClick={() => openUploadForType('OTHER')}
                className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
              >
                <Upload className="h-4 w-4" />
                Upload Other Document
              </button>
            </div>
          )}
        </div>

        {canUploadKyc && (
          <div className="mb-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Bulk KYC upload</h3>
                <p className="text-xs text-muted">
                  Select multiple KYC documents at once. Each file uploads in parallel. We guess the type
                  from the file name – you can change it before uploading.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">
                <Upload className="h-4 w-4" />
                Add files
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    handleBulkFilesSelected(e.target.files);
                    e.currentTarget.value = '';
                  }}
                  disabled={bulkUploading}
                />
              </label>
            </div>

            {bulkItems.length > 0 && (
              <div className="space-y-2">
                {bulkItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm"
                  >
                    <FileText className="h-4 w-4 text-muted" />
                    <span className="max-w-[240px] truncate font-medium" title={item.file.name}>
                      {item.file.name}
                    </span>
                    <span className="text-xs text-muted">
                      ({(item.file.size / 1024).toFixed(1)} KB)
                    </span>
                    <select
                      value={item.documentType}
                      onChange={(e) =>
                        updateBulkItem(item.id, { documentType: e.target.value as DocumentType })
                      }
                      disabled={bulkUploading || item.status === 'uploading' || item.status === 'done'}
                      className="rounded border border-border px-2 py-1 text-xs"
                    >
                      {KYC_DOCUMENT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex items-center gap-2">
                      {item.status === 'pending' && <span className="text-xs text-muted">Ready</span>}
                      {item.status === 'uploading' && (
                        <span className="text-xs text-primary">Uploading {item.progress}%</span>
                      )}
                      {item.status === 'done' && (
                        <span className="text-xs font-semibold text-success">Uploaded</span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-xs text-error" title={item.error}>
                          Failed
                        </span>
                      )}
                      {item.status !== 'uploading' && item.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => removeBulkItem(item.id)}
                          disabled={bulkUploading}
                          className="text-xs text-muted hover:text-error"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleBulkUpload}
                    disabled={
                      bulkUploading ||
                      bulkItems.every((it) => it.status === 'done' || it.status === 'uploading')
                    }
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {bulkUploading
                      ? 'Uploading…'
                      : `Upload ${bulkItems.filter((it) => it.status === 'pending' || it.status === 'error').length} file(s)`}
                  </button>
                  {bulkItems.some((it) => it.status === 'done') && (
                    <button
                      type="button"
                      onClick={() => setBulkItems([])}
                      disabled={bulkUploading}
                      className="rounded-lg border border-border bg-white px-3 py-2 text-xs"
                    >
                      Clear list
                    </button>
                  )}
                  {company?.onboardingStage === 'KYC_IN_PROGRESS' &&
                    bulkItems.some((it) => it.status === 'done') && (
                      <button
                        type="button"
                        onClick={handleSubmitKycForReview}
                        disabled={submittingReview}
                        className="ml-auto rounded-lg border border-success bg-success/10 px-3 py-2 text-xs font-semibold text-success disabled:opacity-50"
                      >
                        {submittingReview ? 'Submitting…' : 'Submit for admin review'}
                      </button>
                    )}
                </div>
                {submitMessage && <p className="mt-2 text-xs text-success">{submitMessage}</p>}
              </div>
            )}
          </div>
        )}

        {canUploadKyc && selectedFile && (
          <form
            id="kyc-upload-form"
            onSubmit={handleUpload}
            className="mb-4 rounded-lg border border-border bg-white p-4 shadow-sm"
          >
            <h3 className="mb-3 text-sm font-semibold">Confirm upload</h3>
            <p className="mb-3 text-sm text-muted">
              <strong>File:</strong> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB){' '}
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f) setSelectedFile(f);
                  };
                  input.click();
                }}
                disabled={uploading}
                className="text-primary hover:underline disabled:opacity-50"
              >
                Change file
              </button>
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                  disabled={uploading}
                  className="w-full rounded border border-border px-3 py-2 text-sm"
                >
                  {KYC_DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {uploadProgress !== null && <p className="text-sm text-muted">Uploading… {uploadProgress}%</p>}
              {uploadSuccess && <p className="text-sm text-success">{uploadSuccess}</p>}
              {uploadError && <p className="text-sm text-error">{uploadError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  disabled={uploading}
                  className="rounded-lg border border-border bg-white px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {kycDocuments.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <FileCheck className="mx-auto mb-3 h-12 w-12 text-muted" />
            <p className="text-muted">No KYC documents uploaded yet.</p>
            {canUploadKyc && (
              <p className="mt-2 text-sm text-muted">
                Upload both Aadhaar and PAN documents using the buttons above.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-4 py-3 text-left text-sm font-semibold">File Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Uploaded</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {kycDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b border-border transition-colors hover:bg-background">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted" />
                        <span className="font-medium">{doc.fileName}</span>
                        {doc.version && typeof doc.version === 'number' && doc.version > 1 ? (
                          <span className="text-xs text-muted">v{doc.version}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{doc.documentType}</td>
                    <td className="px-4 py-3">
                      <Badge variant={documentStatusVariant(doc.status)}>
                        {documentStatusLabel(doc.status)}
                      </Badge>
                      {doc.status === 'REJECTED' && doc.rejectionReason && (
                        <div className="mt-1 flex items-start gap-1 text-xs text-error">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>{doc.rejectionReason}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleView(doc.id, doc.fileName)}
                          className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-xs hover:bg-background"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                        {doc.status === 'VERIFIED' && (
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id)}
                            className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-xs hover:bg-background"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </button>
                        )}
                        {doc.status === 'REJECTED' && canUploadKyc && (
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  setSelectedFile(file);
                                  setDocumentType(doc.documentType as DocumentType);
                                }
                              };
                              input.click();
                            }}
                            className="inline-flex items-center gap-1 rounded border border-primary bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90"
                          >
                            <Upload className="h-3 w-3" />
                            Re-upload
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Agreement draft Section */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Agreement draft
        </h2>
        {documents.filter((d) => d.documentType === 'AGREEMENT_DRAFT').length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-6 text-center">
            <p className="text-muted">No agreement draft shared yet.</p>
            <p className="mt-1 text-sm text-muted">Your agreement draft will appear here once the admin shares it.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents
              .filter((d) => d.documentType === 'AGREEMENT_DRAFT')
              .map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-white p-4 shadow-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted" />
                      <span className="font-medium">{doc.fileName}</span>
                      {doc.version && typeof doc.version === 'number' && doc.version > 1 ? (
                        <span className="text-xs text-muted">v{doc.version}</span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={documentStatusVariant(doc.status)}>
                        {documentStatusLabel(doc.status)}
                      </Badge>
                      <span className="text-xs text-muted">{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleView(doc.id, doc.fileName)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-background"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-background"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Signed agreement Section */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Signed agreement
          </h2>
          {canUploadSigned && (
            <button
              type="button"
              onClick={handleUploadSignedAgreement}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Upload Signed Agreement
            </button>
          )}
        </div>

        {uploadProgress !== null && uploading && (
          <div className="mb-4 rounded-lg border border-border bg-white p-4">
            <p className="text-sm text-muted">Uploading… {uploadProgress}%</p>
          </div>
        )}

        {documents.filter((d) => d.documentType === 'AGREEMENT_SIGNED').length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-6 text-center">
            <p className="text-muted">No signed agreement uploaded yet.</p>
            {canUploadSigned && (
              <p className="mt-1 text-sm text-muted">Download the draft above, sign it, and upload the signed copy here.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {documents
              .filter((d) => d.documentType === 'AGREEMENT_SIGNED')
              .map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-white p-4 shadow-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted" />
                      <span className="font-medium">{doc.fileName}</span>
                      {doc.version && typeof doc.version === 'number' && doc.version > 1 ? (
                        <span className="text-xs text-muted">v{doc.version}</span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={documentStatusVariant(doc.status)}>
                        {documentStatusLabel(doc.status)}
                      </Badge>
                      <span className="text-xs text-muted">{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleView(doc.id, doc.fileName)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-background"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-background"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Post-agreement documents (Final Agreement, NOCs, Bills) */}
      {POST_AGREEMENT_DOC_TYPES.map(({ type, label, emptyMessage }) => {
        const docsOfType = documents.filter((d) => d.documentType === type);
        return (
          <section key={type} className="mb-8">
            <h2 className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {label}
            </h2>
            {docsOfType.length === 0 ? (
              <div className="rounded-lg border border-border bg-white p-6 text-center">
                <p className="text-muted">No {label.toLowerCase()} available yet.</p>
                <p className="mt-1 text-sm text-muted">{emptyMessage}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {docsOfType.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-white p-4 shadow-sm"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted" />
                        <span className="font-medium">{doc.fileName}</span>
                        {doc.version && typeof doc.version === 'number' && doc.version > 1 ? (
                          <span className="text-xs text-muted">v{doc.version}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={documentStatusVariant(doc.status)}>
                          {documentStatusLabel(doc.status)}
                        </Badge>
                        <span className="text-xs text-muted">{formatDate(doc.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleView(doc.id, doc.fileName)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-background"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-background"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

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
    </div>
  );
}
