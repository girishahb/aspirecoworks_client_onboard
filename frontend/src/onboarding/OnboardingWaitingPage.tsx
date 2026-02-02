import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { ComplianceStatus, DocumentListItem } from '../api/types';

const POLL_INTERVAL_MS = 15_000;

function statusLabel(status: string): string {
  switch (status) {
    case 'VERIFIED':
      return 'Approved';
    case 'UPLOADED':
    case 'PENDING':
      return 'Uploaded';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

export function OnboardingWaitingPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [complianceRes, documentsRes] = await Promise.all([
        apiGet<ComplianceStatus>('/compliance/status'),
        apiGet<DocumentListItem[]>('/documents'),
      ]);

      const docList = Array.isArray(documentsRes) ? documentsRes : [];
      setDocuments(docList);

      if (complianceRes.isCompliant) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        navigate('/onboarding', { replace: true });
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();

    intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData]);

  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <p className="text-stone-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            to="/onboarding"
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            ← Back to onboarding
          </Link>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-xl font-semibold text-stone-900">
            Your documents are under review
          </h1>
          <p className="mt-2 text-stone-600">
            We’re reviewing your submissions. This page updates every 15 seconds.
          </p>

          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}

          <ul className="mt-6 space-y-4">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 pb-4 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">
                    {doc.documentType} – {doc.fileName}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    Status: {statusLabel(doc.status)}
                  </p>
                  {doc.status === 'REJECTED' && doc.rejectionReason && (
                    <p className="mt-2 text-sm text-red-600">
                      Reason: {doc.rejectionReason}
                    </p>
                  )}
                </div>
                {doc.status === 'REJECTED' && (
                  <Link
                    to="/onboarding/documents"
                    className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Re-upload
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {documents.length === 0 && !error && (
            <p className="mt-4 text-sm text-stone-500">
              No documents found. You can upload from the documents page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
