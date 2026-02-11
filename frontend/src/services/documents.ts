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
 * Get a presigned download URL for a document.
 * Auth token is sent automatically. Returns the URL; caller can open in new tab or download.
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
