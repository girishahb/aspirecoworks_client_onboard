/**
 * Backend API base URL from environment.
 * Production default: https://api.aspirecoworks.in
 * Set VITE_API_URL to override (e.g. http://localhost:3000 for local dev).
 */
const API_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
    : 'https://api.aspirecoworks.in';

/**
 * Build a full API URL from a path.
 * Ensures a single slash between base and path; path should start with /.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/**
 * Backend API base URL (no trailing slash).
 */
export function getApiBaseUrl(): string {
  return API_BASE;
}
