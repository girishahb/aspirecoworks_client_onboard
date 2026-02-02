import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { ComplianceStatus } from '../api/types';
import {
  requestUploadUrl,
  uploadFileToPresignedUrl,
} from '../api/documents';

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const ACCEPT_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

type RowStatus = 'idle' | 'uploading' | 'success' | 'error';

interface RowState {
  file: File | null;
  status: RowStatus;
  progress: number;
  errorMessage: string | null;
}

function isValidFileType(file: File): boolean {
  return ACCEPT_MIMES.includes(file.type);
}

export function OnboardingDocumentsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingTypes, setMissingTypes] = useState<string[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const compliance = await apiGet<ComplianceStatus>('/compliance/status');
        if (cancelled) return;
        if (compliance.isCompliant) {
          navigate('/onboarding', { replace: true });
          return;
        }
        const missing = compliance.missingDocumentTypes ?? [];
        setMissingTypes(missing);
        setRowState(
          Object.fromEntries(
            missing.map((type) => [
              type,
              { file: null, status: 'idle', progress: 0, errorMessage: null },
            ]),
          ),
        );
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load compliance');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setRow = useCallback((documentType: string, patch: Partial<RowState>) => {
    setRowState((prev) => ({
      ...prev,
      [documentType]: { ...prev[documentType], ...patch },
    }));
  }, []);

  const handleFileChange = useCallback(
    (documentType: string, file: File | null) => {
      if (!file) {
        setRow(documentType, {
          file: null,
          status: 'idle',
          progress: 0,
          errorMessage: null,
        });
        return;
      }
      if (!isValidFileType(file)) {
        setRow(documentType, {
          file: null,
          status: 'error',
          progress: 0,
          errorMessage: 'Use PDF, JPG, or PNG only.',
        });
        return;
      }
      setRow(documentType, {
        file,
        status: 'idle',
        progress: 0,
        errorMessage: null,
      });
    },
    [setRow],
  );

  const handleUpload = useCallback(
    async (documentType: string) => {
      const row = rowState[documentType];
      const file = row?.file;
      if (!file || row?.status === 'uploading') return;

      setRow(documentType, { status: 'uploading', progress: 0, errorMessage: null });

      try {
        const { uploadUrl } = await requestUploadUrl(
          documentType,
          file.name,
          file.size,
          file.type || undefined,
        );

        await uploadFileToPresignedUrl(uploadUrl, file, (percent) =>
          setRow(documentType, { progress: percent }),
        );

        setRow(documentType, {
          status: 'success',
          progress: 100,
          errorMessage: null,
        });
      } catch (e) {
        setRow(documentType, {
          status: 'error',
          progress: 0,
          errorMessage: e instanceof Error ? e.message : 'Upload failed',
        });
      }
    },
    [rowState, setRow],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <p className="text-stone-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link to="/onboarding" className="mt-4 inline-block text-stone-600 underline">
            Back to onboarding
          </Link>
        </div>
      </div>
    );
  }

  if (missingTypes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-stone-900">
            No documents required
          </h1>
          <p className="mt-2 text-stone-600">
            You have no missing document types. You can go back to onboarding.
          </p>
          <Link
            to="/onboarding"
            className="mt-6 inline-block rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
          >
            Back to onboarding
          </Link>
        </div>
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
            Upload required documents
          </h1>
          <p className="mt-2 text-stone-600">
            Upload one file per document type. PDF, JPG, or PNG only.
          </p>

          <ul className="mt-6 space-y-6">
            {missingTypes.map((documentType) => {
              const row = rowState[documentType] ?? {
                file: null,
                status: 'idle',
                progress: 0,
                errorMessage: null,
              };
              const isUploading = row.status === 'uploading';
              const canSubmit = row.file && !isUploading;

              return (
                <li
                  key={documentType}
                  className="border-b border-stone-100 pb-6 last:border-0 last:pb-0"
                >
                  <label className="block text-sm font-medium text-stone-700">
                    {documentType}
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept={ACCEPT}
                      className="block text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
                      disabled={isUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        handleFileChange(documentType, f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={!canSubmit}
                      onClick={() => handleUpload(documentType)}
                      className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                  {isUploading && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full max-w-xs rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-stone-600 transition-[width]"
                          style={{ width: `${row.progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {row.progress}%
                      </p>
                    </div>
                  )}
                  {row.status === 'success' && (
                    <p className="mt-2 text-sm text-green-600">Uploaded.</p>
                  )}
                  {row.status === 'error' && row.errorMessage && (
                    <p className="mt-2 text-sm text-red-600">{row.errorMessage}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
