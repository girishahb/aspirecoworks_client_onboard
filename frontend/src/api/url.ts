/**
 * Backend API base URL from environment.
 * - VITE_API_URL: explicit override (e.g. http://localhost:3000)
 * - Dev mode (npm run dev): defaults to http://localhost:3000
 * - Production: defaults to https://api.aspirecoworks.in
 */
function getApiBase(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
  }
  // In Vite dev mode, default to local backend
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return 'http://localhost:3000';
  }
  return 'https://api.aspirecoworks.in';
}
const API_BASE = getApiBase();

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
