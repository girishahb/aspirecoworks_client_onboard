import { apiGet, apiPost } from './api';
import { apiUrl } from '../api/url';
import { getAuthHeaders, logout, setSessionExpired } from './auth';

export type VisitorStatus = 'CHECKED_IN' | 'CHECKED_OUT';

export type VisitorListItem = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  purpose: string;
  hostName?: string | null;
  hostEmail?: string | null;
  status: VisitorStatus;
  checkInAt: string;
  checkOutAt?: string | null;
  aadhaarConsent: boolean;
  aadhaarLast4Masked?: string | null;
  locationId?: string | null;
  location?: { id: string; name: string; code: string | null } | null;
  hostEmailSent: boolean;
  checkedInBy?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export type VisitorDetail = VisitorListItem & {
  aadhaarLast4?: string | null;
  aadhaarConsentAt?: string | null;
  aadhaarConsentVersion?: string | null;
  hasFacePhoto: boolean;
  hasSignature: boolean;
  hasAadhaarPhoto: boolean;
  hostEmailError?: string | null;
  hostEmailAttempted?: boolean;
  checkedOutBy?: VisitorListItem['checkedInBy'];
  createdAt?: string;
};

export type VisitorConsentMeta = {
  version: string;
  text: string;
  retentionDays: number;
};

export type ImagePayload = {
  imageBase64: string;
  mimeType?: 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/webp';
};

export type CheckInVisitorBody = {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  purpose: string;
  hostName?: string;
  hostEmail?: string;
  locationId?: string;
  facePhoto: ImagePayload;
  signature: ImagePayload;
  aadhaarConsent?: boolean;
  aadhaarLast4?: string;
  aadhaarPhoto?: ImagePayload;
  aadhaarConsentVersion?: string;
};

export function canManageVisitors(role?: string | null): boolean {
  return [
    'RECEPTION',
    'STAFF',
    'FINANCE',
    'ADMIN',
    'SUPER_ADMIN',
    'MANAGER',
  ].includes((role || '').toUpperCase());
}

export function getVisitorConsentMeta() {
  return apiGet<VisitorConsentMeta>('/visitors/consent-meta');
}

export function checkInVisitor(body: CheckInVisitorBody) {
  return apiPost<VisitorDetail>('/visitors/check-in', body);
}

export function listVisitorsToday(opts?: { locationId?: string; date?: string }) {
  const params = new URLSearchParams();
  if (opts?.locationId) params.set('locationId', opts.locationId);
  if (opts?.date) params.set('date', opts.date);
  const qs = params.toString();
  return apiGet<{ date: string; rows: VisitorListItem[] }>(
    qs ? `/visitors/today?${qs}` : '/visitors/today',
  );
}

export function getVisitor(id: string) {
  return apiGet<VisitorDetail>(`/visitors/${id}`);
}

export function checkoutVisitor(id: string) {
  return apiPost<VisitorDetail>(`/visitors/${id}/checkout`, {});
}

/** Authenticated blob URL for private visitor media (revoke after use). */
export async function fetchVisitorMediaObjectUrl(
  id: string,
  kind: 'face' | 'signature' | 'aadhaar',
): Promise<string> {
  const res = await fetch(apiUrl(`/visitors/${id}/media/${kind}`), {
    headers: { ...getAuthHeaders() },
  });
  if (res.status === 401) {
    setSessionExpired();
    logout();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    throw new Error(`Failed to load ${kind} media`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function listAdminVisitors(opts: {
  from?: string;
  to?: string;
  locationId?: string;
  q?: string;
  status?: VisitorStatus | 'all';
}) {
  const params = new URLSearchParams();
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.locationId) params.set('locationId', opts.locationId);
  if (opts.q) params.set('q', opts.q);
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString();
  return apiGet<{ from: string; to: string; rows: VisitorListItem[] }>(
    qs ? `/admin/visitors?${qs}` : '/admin/visitors',
  );
}

export async function downloadVisitorsExcel(opts: {
  from?: string;
  to?: string;
  locationId?: string;
  q?: string;
  status?: VisitorStatus | 'all';
}) {
  const params = new URLSearchParams();
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.locationId) params.set('locationId', opts.locationId);
  if (opts.q) params.set('q', opts.q);
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString();
  const res = await fetch(
    apiUrl(qs ? `/admin/visitors/export?${qs}` : '/admin/visitors/export'),
    { headers: { ...getAuthHeaders() } },
  );
  if (res.status === 401) {
    setSessionExpired();
    logout();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    throw new Error('Excel export failed');
  }
  const blob = await res.blob();
  let fileName = 'visitors.xlsx';
  const cd = res.headers.get('Content-Disposition');
  const match = cd?.match(/filename="([^"]+)"/);
  if (match?.[1]) fileName = match[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
