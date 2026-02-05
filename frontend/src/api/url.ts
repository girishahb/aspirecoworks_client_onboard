/**
 * Backend API base URL from environment.
 * Falls back to http://localhost:3000 when unset (e.g. dev).
 */
const BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
    : 'http://localhost:3000';

/**
 * Build a full API URL from a path.
 * Ensures a single slash between base and path; path should start with /.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${p}`;
}

/**
 * Backend API base URL (no trailing slash).
 */
export function getApiBaseUrl(): string {
  return BASE_URL;
}
