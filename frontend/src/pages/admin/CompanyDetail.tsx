import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, apiPatch } from '../../api/client';
import type { AdminCompany, ComplianceStatus } from '../../api/types';
import type { DocumentListItem } from '../../api/types';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/table/DataTable';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

interface DownloadResponse {
  documentId: string;
  fileName: string;
  downloadUrl: string;
  expiresIn: number;
}

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<AdminCompany | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [actioningId, setActioningId] = useState<string | null>(null);

  async function loadCompany() {
    if (!id) return null;
    const list = await apiGet<AdminCompany[]>('/companies');
    return (Array.isArray(list) ? list : []).find((c) => c.id === id) ?? null;
  }

  async function loadDocuments() {
    if (!id) return [];
    const list = await apiGet<DocumentListItem[]>(`/documents/company/${id}`);
    return Array.isArray(list) ? list : [];
  }

  async function load() {
    if (!id) {
      setError('Missing company id');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [companyRes, docsRes] = await Promise.all([
        loadCompany(),
        loadDocuments(),
      ]);
      setCompany(companyRes ?? null);
      setDocuments(docsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setCompany(null);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleDownload(docId: string) {
    try {
      const res = await apiGet<DownloadResponse>(`/documents/${docId}/download`);
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  }

  async function tryActivateCompany() {
    if (!id) return;
    try {
      const compliance = await apiGet<ComplianceStatus>(`/compliance/company/${id}`);
      if (compliance?.isCompliant) {
        await apiPatch(`/companies/${id}/status`, { status: 'COMPLETED' });
        const updated = await loadCompany();
        if (updated) setCompany(updated);
      }
    } catch (err) {
      console.error('Activate company check failed:', err);
    }
  }

  async function handleApprove(docId: string) {
    setActioningId(docId);
    try {
      await apiPatch(`/documents/${docId}/review`, { status: 'VERIFIED' });
      const docs = await loadDocuments();
      setDocuments(docs);
      await tryActivateCompany();
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(docId: string) {
    const reason =
      rejectionReasons[docId]?.trim() ||
      (typeof window !== 'undefined' ? window.prompt('Rejection reason (required):') ?? '' : '').trim();
    if (!reason) {
      return;
    }
    setActioningId(docId);
    try {
      await apiPatch(`/documents/${docId}/review`, {
        status: 'REJECTED',
        rejectionReason: reason,
      });
      setRejectionReasons((prev) => ({ ...prev, [docId]: '' }));
      const docs = await loadDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActioningId(null);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageHeader title="Company Detail" />
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
          <Link to="/admin/companies" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800">
            ← Back to companies
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (!company) {
    return (
      <DashboardLayout>
        <PageHeader title="Company Detail" />
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">Company not found.</p>
          <Link to="/admin/companies" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800">
            ← Back to companies
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const documentColumns = [
    {
      key: 'documentType',
      header: 'Document Type',
    },
    {
      key: 'status',
      header: 'Status',
      render: (doc: DocumentListItem) => (
        <div>
          <Badge status={doc.status} />
          {doc.rejectionReason && (
            <p className="mt-1 text-xs text-gray-500">{doc.rejectionReason}</p>
          )}
        </div>
      ),
    },
    {
      key: 'fileName',
      header: 'File Name',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (doc: DocumentListItem) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(doc.id);
            }}
          >
            Download
          </Button>
          {doc.status !== 'VERIFIED' && (
            <Button
              variant="success"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleApprove(doc.id);
              }}
              disabled={actioningId === doc.id}
              isLoading={actioningId === doc.id}
            >
              Approve
            </Button>
          )}
          {doc.status !== 'REJECTED' && (
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Rejection reason"
                value={rejectionReasons[doc.id] ?? ''}
                onChange={(e) =>
                  setRejectionReasons((prev) => ({
                    ...prev,
                    [doc.id]: e.target.value,
                  }))
                }
                className="w-48"
              />
              <Button
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReject(doc.id);
                }}
                disabled={actioningId === doc.id || !rejectionReasons[doc.id]?.trim()}
                isLoading={actioningId === doc.id}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Company Detail"
        breadcrumbs={[
          { label: 'Admin', path: '/admin/companies' },
          { label: 'Companies', path: '/admin/companies' },
          { label: company.companyName },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{company.companyName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Contact Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{company.contactEmail}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <Badge status={company.onboardingStatus} />
                </dd>
              </div>
              {company.renewalDate && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Renewal Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(company.renewalDate)}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Created Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(company.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            {documents.length === 0 ? (
              <p className="text-sm text-gray-500">No documents uploaded.</p>
            ) : (
              <DataTable
                columns={documentColumns}
                data={documents}
                loading={false}
                emptyMessage="No documents found."
                keyExtractor={(doc) => doc.id}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
