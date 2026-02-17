import { apiUrl } from '../api/url';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export interface LoginResponse {
  access_token: string;
  user?: { id: string; email: string; firstName?: string; lastName?: string; role?: string; companyId?: string | null };
}

export type StoredUser = LoginResponse['user'];

/**
 * Login with email and password. Stores JWT and user in localStorage on success.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Login failed');
  }

  const data = (await res.json()) as LoginResponse;
  console.log('[login] Login response:', { 
    hasToken: !!data.access_token, 
    user: data.user,
    userCompanyId: data.user?.companyId 
  });
  
  if (data.access_token) {
    localStorage.setItem(TOKEN_KEY, data.access_token);
  }
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  return data;
}

/**
 * Request password reset link. Always returns success to avoid email enumeration.
 */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await fetch(apiUrl('/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Failed to send reset link');
  }

  return res.json();
}

/**
 * Reset password using token from email link.
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(apiUrl('/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Failed to reset password');
  }

  return res.json();
}

/**
 * Set password for invited client (from email link).
 * Returns same shape as login (access_token, user). Stores in localStorage and returns.
 */
export async function setPassword(token: string, newPassword: string): Promise<LoginResponse> {
  const res = await fetch(apiUrl('/auth/set-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Failed to set password');
  }

  const data = (await res.json()) as LoginResponse;
  if (data.access_token) {
    localStorage.setItem(TOKEN_KEY, data.access_token);
  }
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  return data;
}

const SESSION_EXPIRED_KEY = 'session_expired';

/**
 * Remove stored token and user (logout).
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Mark that the user was logged out due to session expiry (401).
 * Used by login pages to show "Session expired" message.
 */
export function setSessionExpired(): void {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Check and clear the session-expired flag. Returns true if it was set.
 */
export function clearSessionExpired(): boolean {
  try {
    const wasSet = sessionStorage.getItem(SESSION_EXPIRED_KEY) === '1';
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    return !!wasSet;
  } catch {
    return false;
  }
}

/**
 * Get stored user from login response, or null.
 * Returns null if not authenticated or on error.
 */
export function getCurrentUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

/**
 * Get stored JWT or null.
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * True if a token is stored.
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Headers object with Authorization: Bearer &lt;token&gt; when authenticated.
 * Use with fetch: fetch(url, { headers: { ...getAuthHeaders(), ...otherHeaders } })
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetch with Authorization header attached when authenticated.
 */
export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : apiUrl(path);
  const headers = new Headers(options.headers);
  const auth = getAuthHeaders();
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}
