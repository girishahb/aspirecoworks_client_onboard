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
 * Remove stored token and user (logout).
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
