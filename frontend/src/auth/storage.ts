/**
 * Stored user role for route guards and 403 handling.
 * Set this on login (e.g. from JWT payload or /auth/me response).
 */
const ROLE_KEY = 'userRole';

export function getStoredRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ROLE_KEY);
}

export function setStoredRole(role: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ROLE_KEY, role);
}

export function clearStoredRole(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ROLE_KEY);
}

export function isSuperAdmin(): boolean {
  return getStoredRole() === 'SUPER_ADMIN';
}
