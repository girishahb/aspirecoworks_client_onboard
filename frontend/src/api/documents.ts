import { apiPost } from './client';
import type { GenerateUploadUrlResponse } from './types';

/**
 * Document upload API service.
 * No S3/R2 credentials in frontend; uses backend for presigned URLs only.
 */

export interface RequestUploadUrlResult {
  uploadUrl: string;
  documentId: string;
}

/**
 * Request a presigned upload URL from the backend.
 * Caller must then upload the file to uploadUrl (e.g. via uploadFileToPresignedUrl).
 */
export async function requestUploadUrl(
  type: string,
  filename: string,
  fileSize: number,
  mimeType?: string,
): Promise<RequestUploadUrlResult> {
  if (!type?.trim()) {
    throw new Error('Document type is required');
  }
  if (!filename?.trim()) {
    throw new Error('Filename is required');
  }
  if (!Number.isInteger(fileSize) || fileSize <= 0) {
    throw new Error('File size must be a positive integer');
  }

  try {
    const res = await apiPost<GenerateUploadUrlResponse>(
      '/documents/upload-url',
      {
        documentType: type,
        fileName: filename,
        fileSize,
        mimeType: mimeType ?? undefined,
      },
    );

    if (!res?.uploadUrl) {
      throw new Error('Invalid response: missing upload URL');
    }

    return {
      uploadUrl: res.uploadUrl,
      documentId: res.documentId ?? '',
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to get upload URL';
    throw new Error(message);
  }
}

/**
 * Upload a file directly to a presigned URL (storage, not backend).
 * Uses fetch. For upload progress, pass onProgress (uses XHR under the hood).
 */
export async function uploadFileToPresignedUrl(
  url: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (!url?.trim()) {
    throw new Error('Upload URL is required');
  }
  if (!(file instanceof File)) {
    throw new Error('A File object is required');
  }

  if (onProgress != null) {
    return putWithProgress(url, file, onProgress);
  }

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: file.type ? { 'Content-Type': file.type } : undefined,
      body: file,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Upload to storage failed';
    throw new Error(message);
  }
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', url);
    if (file.type) {
      xhr.setRequestHeader('Content-Type', file.type);
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () =>
      reject(new Error('Network error during upload')),
    );
    xhr.addEventListener('abort', () =>
      reject(new Error('Upload aborted')),
    );

    xhr.send(file);
  });
}
