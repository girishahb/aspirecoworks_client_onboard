import { apiGet, apiRequest } from './api';

/** Document types supported by the backend. */
export type DocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'CONTRACT'
  | 'LICENSE'
  | 'CERTIFICATE'
  | 'IDENTIFICATION'
  | 'FINANCIAL'
  | 'KYC'
  | 'AGREEMENT_DRAFT'
  | 'AGREEMENT_SIGNED'
  | 'AGREEMENT_FINAL'
  | 'OTHER';

export interface DocumentListItem {
  id: string;
  documentType: string;
  status: string;
  fileName: string;
  createdAt: string;
  rejectionReason?: string | null;
  clientProfileId?: string;
  [key: string]: unknown;
}

interface DownloadUrlResponse {
  documentId: string;
  fileName: string;
  downloadUrl: string;
  expiresIn: number;
}

/**
 * Upload a document via backend proxy (multipart/form-data).
 * Avoids CORS issues with presigned R2 URLs. Optional onProgress(0-100).
 */
export async function uploadDocument(
  file: File,
  documentType: DocumentType,
  onProgress?: (percent: number) => void
): Promise<{ documentId: string }> {
  if (onProgress) onProgress(10);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const res = await apiRequest('/documents/upload', {
    method: 'POST',
    body: formData,
  });

  if (onProgress) onProgress(100);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new Error(message || `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as { documentId: string };
  return { documentId: data.documentId };
}

/**
 * Upload signed agreement (CLIENT only, when stage is AGREEMENT_DRAFT_SHARED).
 * Uses proxy upload; backend handles confirm-signed-agreement automatically.
 */
export async function uploadSignedAgreement(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ documentId: string }> {
  return uploadDocument(file, 'AGREEMENT_SIGNED', onProgress);
}

/**
 * List documents for the current user's company.
 * Auth token is sent automatically.
 */
export async function listMyDocuments(): Promise<DocumentListItem[]> {
  const data = await apiGet<DocumentListItem[]>('/documents');
  return Array.isArray(data) ? data : [];
}

/**
 * Get a presigned download URL for a document (legacy).
 * Prefer downloadDocumentFile for proxy download with forced save and better error handling.
 */
export async function downloadDocument(
  documentId: string
): Promise<{ downloadUrl: string; fileName: string }> {
  const data = await apiGet<DownloadUrlResponse>(`/documents/${documentId}/download`);
  return {
    downloadUrl: data.downloadUrl,
    fileName: data.fileName ?? 'document',
  };
}

/**
 * Download document via proxy (streams through backend).
 * Triggers browser download with correct filename. Handles missing files with a clear error.
 */
export async function downloadDocumentFile(documentId: string): Promise<void> {
  const { apiUrl } = await import('../api/url');
  const { getAuthHeaders } = await import('./auth');
  const res = await fetch(apiUrl(`/documents/${documentId}/file`), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (err as { message?: string }).message ?? `Download failed (${res.status})`
    );
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition');
  let fileName = 'document';
  const match = contentDisposition?.match(/filename="?([^";\n]+)"?/);
  if (match) fileName = match[1].replace(/\\"/g, '"');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
