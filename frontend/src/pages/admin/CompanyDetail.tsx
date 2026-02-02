import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, apiPatch } from '../../api/client';
import type { AdminCompany, ComplianceStatus } from '../../api/types';
import type { DocumentListItem } from '../../api/types';

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

  /** When all required document types have an approved (VERIFIED) doc, set company status to COMPLETED (ACTIVE). */
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
      <div>
        <h1>Company detail</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>Company detail</h1>
        <p style={{ color: 'crimson' }}>{error}</p>
        <Link to="/admin/companies">Back to companies</Link>
      </div>
    );
  }

  if (!company) {
    return (
      <div>
        <h1>Company detail</h1>
        <p>Company not found.</p>
        <Link to="/admin/companies">Back to companies</Link>
      </div>
    );
  }

  return (
    <div>
      <p style={{ marginBottom: '1rem' }}>
        <Link to="/admin/companies">← Back to companies</Link>
      </p>
      <h1>Company detail</h1>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Company</h2>
        <p><strong>Name:</strong> {company.companyName}</p>
        <p><strong>Contact email:</strong> {company.contactEmail}</p>
        <p><strong>Status:</strong> {company.onboardingStatus}</p>
        {company.renewalDate && (
          <p><strong>Renewal date:</strong> {formatDate(company.renewalDate)}</p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Documents</h2>
        {documents.length === 0 ? (
          <p style={{ color: '#666' }}>No documents.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '56rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Document type</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>File name</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{doc.documentType}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {doc.status}
                    {doc.rejectionReason && (
                      <span style={{ color: '#666', display: 'block', fontSize: '0.85rem' }}>
                        {doc.rejectionReason}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{doc.fileName}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      style={{ marginRight: '0.5rem', padding: '0.35rem 0.6rem' }}
                    >
                      Download
                    </button>
                    {doc.status !== 'VERIFIED' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(doc.id)}
                        disabled={actioningId === doc.id}
                        style={{ marginRight: '0.5rem', padding: '0.35rem 0.6rem' }}
                      >
                        Approve
                      </button>
                    )}
                    {doc.status !== 'REJECTED' && (
                      <>
                        <input
                          type="text"
                          placeholder="Rejection reason"
                          value={rejectionReasons[doc.id] ?? ''}
                          onChange={(e) =>
                            setRejectionReasons((prev) => ({
                              ...prev,
                              [doc.id]: e.target.value,
                            }))
                          }
                          style={{
                            width: '10rem',
                            padding: '0.3rem 0.5rem',
                            marginRight: '0.35rem',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleReject(doc.id)}
                          disabled={actioningId === doc.id || !rejectionReasons[doc.id]?.trim()}
                          style={{ padding: '0.35rem 0.6rem' }}
                        >
                          Reject
                        </button>
                      </>
                    )}
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
