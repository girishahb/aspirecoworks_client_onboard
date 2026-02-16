import { apiUrl } from '../api/url';
import { getAuthHeaders, logout, setSessionExpired } from './auth';

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Parse response body as JSON safely.
 */
async function parseJson(res: Response): Promise<unknown> {
  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON in response');
  }
}

/**
 * Reusable API client. Uses fetch, adds Authorization when JWT exists,
 * logs out on 401, and parses JSON safely.
 */
async function request(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : apiUrl(path);
  const headers = new Headers(init.headers);
  const auth = getAuthHeaders();
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
  const isFormData = init.body instanceof FormData;
  if (!headers.has('Content-Type') && init.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const body = isFormData
    ? (init.body as BodyInit)
    : init.body !== undefined && typeof init.body !== 'string'
      ? JSON.stringify(init.body)
      : (init.body as BodyInit | undefined);

  const res = await fetch(url, { ...init, headers, body });

  if (res.status === 401) {
    setSessionExpired();
    logout();
    const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    const loginUrl = isAdminPath ? '/admin/login' : '/login';
    if (typeof window !== 'undefined') {
      window.location.href = loginUrl;
    }
  }

  return res;
}

/**
 * GET request. Returns parsed JSON or null.
 */
export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await request(path, { method: 'GET' });
  const data = await parseJson(res);
  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message: unknown }).message)
      : res.statusText;
    throw new Error(message || `Request failed ${res.status}`);
  }
  return data as T;
}

/**
 * POST request. Sends body as JSON, returns parsed JSON or null.
 */
export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await request(path, { method: 'POST', body });
  const data = await parseJson(res);
  if (!res.ok) {
    // Log the full error response for debugging
    console.error('API Error Response:', data);
    
    let message = typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message: unknown }).message)
      : res.statusText;
    
    // Include validation errors if present - check multiple possible structures
    let errorDetails: string[] = [];
    if (typeof data === 'object' && data !== null) {
      // Check for errors array directly
      if ('errors' in data && Array.isArray((data as { errors: unknown }).errors)) {
        const errors = (data as { errors: unknown[] }).errors;
        errorDetails = errors.map((e: any) => {
          if (typeof e === 'object' && e !== null) {
            if ('path' in e && 'message' in e) {
              return `${e.path}: ${e.message}`;
            }
            if ('message' in e) {
              return String(e.message);
            }
          }
          return String(e);
        });
      }
      // Check for message array (NestJS sometimes formats errors this way)
      if ('message' in data && Array.isArray((data as { message: unknown }).message)) {
        errorDetails = (data as { message: string[] }).message.map(m => String(m));
      }
    }
    
    // If message already contains details (from ZodValidationPipe), use it as-is
    // Otherwise, append error details
    if (errorDetails.length > 0 && !message.includes(':')) {
      message = `${message}\n\nValidation Errors:\n${errorDetails.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;
    }
    
    const error = new Error(message || `Request failed ${res.status}`);
    (error as any).response = data;
    throw error;
  }
  return data as T;
}

/**
 * PATCH request. Sends body as JSON, returns parsed JSON or null.
 */
export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await request(path, { method: 'PATCH', body });
  const data = await parseJson(res);
  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message: unknown }).message)
      : res.statusText;
    throw new Error(message || `Request failed ${res.status}`);
  }
  return data as T;
}

/**
 * PUT request. Sends body as JSON, returns parsed JSON or null.
 */
export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await request(path, { method: 'PUT', body });
  const data = await parseJson(res);
  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message: unknown }).message)
      : res.statusText;
    throw new Error(message || `Request failed ${res.status}`);
  }
  return data as T;
}

/**
 * DELETE request. Returns parsed JSON or null.
 */
export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await request(path, { method: 'DELETE' });
  const data = await parseJson(res);
  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message: unknown }).message)
      : res.statusText;
    throw new Error(message || `Request failed ${res.status}`);
  }
  return data as T;
}

/**
 * Raw request (returns Response). Use when you need headers or non-JSON body.
 */
export async function apiRequest(path: string, init: ApiRequestInit = {}): Promise<Response> {
  return request(path, init);
}
