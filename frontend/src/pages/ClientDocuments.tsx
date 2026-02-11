import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  listMyDocuments,
  downloadDocumentFile,
  uploadDocument,
  uploadSignedAgreement,
  type DocumentListItem,
  type DocumentType,
} from '../services/documents';
import { getMyCompany } from '../services/company';
import Badge from '../components/Badge';
import { Download, Upload, FileText, FileCheck, AlertCircle } from 'lucide-react';

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
    (d) => !['AGREEMENT_DRAFT', 'AGREEMENT_SIGNED', 'AGREEMENT_FINAL'].includes(d.documentType),
  );
  const agreements = documents.filter((d) =>
    ['AGREEMENT_DRAFT', 'AGREEMENT_SIGNED', 'AGREEMENT_FINAL'].includes(d.documentType),
  );

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
  const canUploadSigned = company?.onboardingStage === 'AGREEMENT_DRAFT_SHARED';

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

      {/* Agreements Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agreements
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

        {agreements.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-8 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-muted" />
            <p className="text-muted">No agreements available yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agreements.map((doc) => (
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
    </div>
  );
}
