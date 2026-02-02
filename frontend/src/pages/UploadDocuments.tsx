import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';
import { requestUploadUrl, uploadFileToPresignedUrl } from '../api/documents';
import type { DocumentListItem } from '../api/types';

const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'CERTIFICATE', label: 'GST Certificate' },
  { value: 'CONTRACT', label: 'Agreement' },
];

function statusLabel(status: string): string {
  if (status === 'VERIFIED') return 'Approved';
  return status;
}

export default function UploadDocuments() {
  const companyId = typeof window !== 'undefined' ? localStorage.getItem('companyId') : null;
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPE_OPTIONS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments() {
    setError(null);
    try {
      const list = await apiGet<DocumentListItem[]>('/documents');
      setDocuments(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Select a file');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { uploadUrl, documentId } = await requestUploadUrl(
        documentType,
        file.name,
        file.size,
        file.type || undefined,
      );
      await uploadFileToPresignedUrl(uploadUrl, file);
      await loadDocuments();
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h1>Upload documents</h1>
      {companyId != null && (
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
          Company ID: {companyId}
        </p>
      )}

      <form onSubmit={handleUpload} style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="documentType" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Document type
          </label>
          <select
            id="documentType"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            style={{ padding: '0.35rem', minWidth: '12rem' }}
          >
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="file" style={{ display: 'block', marginBottom: '0.25rem' }}>
            File
          </label>
          <input
            id="file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: 'block' }}
          />
        </div>
        {error && (
          <p style={{ color: 'crimson', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={uploading || !file} style={{ padding: '0.4rem 0.75rem' }}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Uploaded documents</h2>
      {loading ? (
        <p>Loading…</p>
      ) : documents.length === 0 ? (
        <p style={{ color: '#666' }}>No documents yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {documents.map((doc) => (
            <li
              key={doc.id}
              style={{
                padding: '0.5rem 0',
                borderBottom: '1px solid #eee',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span>{doc.fileName}</span>
              <span style={{ fontWeight: 500 }}>
                {statusLabel(doc.status)}
                {doc.rejectionReason && (
                  <span style={{ color: '#666', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                    — {doc.rejectionReason}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/status" style={{ padding: '0.4rem 0.75rem', display: 'inline-block' }}>
          Go to Status
        </Link>
      </p>
    </div>
  );
}
