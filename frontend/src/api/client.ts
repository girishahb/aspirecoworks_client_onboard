import { getStoredRole } from '../auth/storage';

const API_BASE =
  typeof import.meta.env?.VITE_API_BASE_URL === 'string'
    ? import.meta.env.VITE_API_BASE_URL
    : '/api';

const COMPANY_INACTIVE_MESSAGE = 'Company is inactive or non-compliant';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function handle403Redirect(text: string): void {
  if (
    text.includes(COMPANY_INACTIVE_MESSAGE) &&
    getStoredRole() !== 'SUPER_ADMIN'
  ) {
    window.location.assign('/onboarding');
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) {
      handle403Redirect(text);
      throw new Error('Access denied');
    }
    throw new Error(res.status === 401 ? 'Unauthorized' : text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) {
      handle403Redirect(text);
      throw new Error('Access denied');
    }
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) {
      handle403Redirect(text);
      throw new Error('Access denied');
    }
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
