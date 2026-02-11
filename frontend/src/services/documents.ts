import { apiGet, apiPost } from './api';

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

interface UploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

interface DownloadUrlResponse {
  documentId: string;
  fileName: string;
  downloadUrl: string;
  expiresIn: number;
}

/**
 * Upload a document: get presigned URL from backend (auth token sent automatically),
 * then PUT the file to storage. Backend uses presigned URLs, not multipart/form-data.
 * Optional onProgress(0-100) is called during the PUT.
 */
export async function uploadDocument(
  file: File,
  documentType: DocumentType,
  onProgress?: (percent: number) => void
): Promise<{ documentId: string }> {
  const payload = {
    fileName: file.name,
    documentType,
    fileSize: file.size,
    mimeType: file.type || undefined,
  };
  const data = await apiPost<UploadUrlResponse>('/documents/upload-url', payload);
  if (onProgress) onProgress(10);

  const putOk = await putFileWithProgress(
    data.uploadUrl,
    file,
    (loaded, total) => {
      if (total > 0) {
        const p = 10 + Math.round((loaded / total) * 90);
        onProgress?.(p);
      }
    }
  );
  if (!putOk) {
    throw new Error('Upload failed');
  }
  if (onProgress) onProgress(100);
  return { documentId: data.documentId };
}

/**
 * Upload signed agreement (CLIENT only, when stage is AGREEMENT_DRAFT_SHARED).
 * Gets upload URL for type AGREEMENT_SIGNED, uploads file, then confirms to update stage to SIGNED_AGREEMENT_RECEIVED.
 */
export async function uploadSignedAgreement(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ documentId: string }> {
  const payload = {
    fileName: file.name,
    documentType: 'AGREEMENT_SIGNED' as DocumentType,
    fileSize: file.size,
    mimeType: file.type || undefined,
  };
  const data = await apiPost<UploadUrlResponse>('/documents/upload-url', payload);
  if (onProgress) onProgress(10);

  const putOk = await putFileWithProgress(
    data.uploadUrl,
    file,
    (loaded, total) => {
      if (total > 0) {
        const p = 10 + Math.round((loaded / total) * 80);
        onProgress?.(p);
      }
    }
  );
  if (!putOk) {
    throw new Error('Upload failed');
  }
  if (onProgress) onProgress(90);
  await apiPost<{ success: boolean }>(`/documents/${data.documentId}/confirm-signed-agreement`);
  if (onProgress) onProgress(100);
  return { documentId: data.documentId };
}

function putFileWithProgress(
  url: string,
  file: File,
  onProgress: (loaded: number, total: number) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded, e.total);
      }
    });
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
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
