import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'aspire_access_token';
const USER_KEY = 'aspire_user';

export type MobileRole = 'FINANCE' | 'STAFF' | 'RECEPTION' | 'ADMIN' | 'SUPER_ADMIN' | 'MANAGER' | string;

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: MobileRole;
};

/** Fallback for release builds if env was missing at bundle time. */
const DEFAULT_API = 'https://api.aspirecoworks.in';

export function getApiBase(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || DEFAULT_API;
}

export async function saveSession(token: string, user: AuthUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    const msg = body?.message || body?.error || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body as T;
}

/** JSON base64 upload for reception mail photo (avoids RN FormData bugs). */
export async function notifyMailReceived(
  clientId: string,
  imageBase64: string,
  mimeType: string,
  note?: string,
): Promise<{ sent: boolean; to: string; receivedAtIst: string }> {
  return apiRequest(`/mobile/clients/${clientId}/mail-notify`, {
    method: 'POST',
    body: JSON.stringify({
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
      fileName: 'mail-received.jpg',
      ...(note?.trim() ? { note: note.trim() } : {}),
    }),
  });
}

export async function login(email: string, password: string) {
  const data = await apiRequest<{ access_token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveSession(data.access_token, data.user);
  return data.user;
}

export function canWriteClients(role: MobileRole) {
  return ['STAFF', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'].includes(role);
}

export function canSeeMoney(role: MobileRole) {
  return ['FINANCE', 'ADMIN', 'SUPER_ADMIN'].includes(role);
}
