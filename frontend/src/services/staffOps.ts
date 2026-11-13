import { apiGet, apiPatch, apiPost } from './api';

export type StaffRole =
  | 'FINANCE'
  | 'STAFF'
  | 'RECEPTION'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | string;

/** Roles allowed into the Staff Ops web portal (same as mobile lookup). */
export const STAFF_PORTAL_ROLES = [
  'RECEPTION',
  'STAFF',
  'FINANCE',
  'ADMIN',
  'SUPER_ADMIN',
  'MANAGER',
] as const;

export function isStaffPortalRole(role?: string | null): boolean {
  return !!role && STAFF_PORTAL_ROLES.includes(role as (typeof STAFF_PORTAL_ROLES)[number]);
}

export function canWriteClients(role?: string | null): boolean {
  return ['STAFF', 'FINANCE', 'ADMIN', 'SUPER_ADMIN'].includes((role || '').toUpperCase());
}

/** Agreement dates + booking ID renewals (Onboarding / admin). */
export function canEditContractTerm(role?: string | null): boolean {
  return ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes((role || '').toUpperCase());
}

export function canSeeMoney(role?: string | null): boolean {
  return ['FINANCE', 'ADMIN', 'SUPER_ADMIN'].includes((role || '').toUpperCase());
}

export function canNotifyMail(role?: string | null): boolean {
  return ['RECEPTION', 'ADMIN', 'SUPER_ADMIN'].includes((role || '').toUpperCase());
}

export function roleLabel(role?: string | null): string {
  switch ((role || '').toUpperCase()) {
    case 'STAFF':
      return 'Onboarding';
    case 'RECEPTION':
      return 'Front Desk';
    case 'FINANCE':
      return 'Finance';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return 'Admin';
    case 'MANAGER':
      return 'Manager';
    default:
      return role || 'Staff';
  }
}

export function homeHint(role?: string | null): string {
  switch ((role || '').toUpperCase()) {
    case 'STAFF':
      return 'Create clients, capture Booking ID and notes, and look up records for onboarding.';
    case 'RECEPTION':
      return 'Check in visitors, work support tickets from the branch queue, find clients, and notify them about incoming mail.';
    case 'FINANCE':
      return 'Look up clients, check rate cards, and review recent payments and invoices.';
    default:
      return 'Use Find client to look up a company, or open a task below.';
  }
}

export type StaffClientCard = {
  id: string;
  companyName: string;
  contactPersonName?: string | null;
  contactPersonTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactPersonPhone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  taxId?: string | null;
  gstNumber?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  contractMonths?: number | null;
  membershipType?: string | null;
  officeType?: string | null;
  leadSource?: string | null;
  clientChannel?: string | null;
  aggregatorName?: string | null;
  externalBookingId?: string | null;
  onboardingStage?: string | null;
  renewalStatus?: string | null;
  renewalDate?: string | null;
  kycCompleted?: boolean | null;
  notes?: string | null;
  operationalStatus?: string;
  isActive?: boolean;
  payments?: { id: string; amount: number; status: string }[];
  invoices?: { id: string; invoiceNumber: string; totalAmount: number }[];
  location?: { name?: string; code?: string } | null;
  vendor?: { name?: string; code?: string } | null;
  rateCard?: { membershipType: string; rateExclusive: number; currency: string }[];
  applicableRate?: { membershipType: string; rateExclusive: number; currency: string } | null;
  legacyCharges?: number | null;
  legacyPaymentStatus?: string | null;
};

export type MetaLocation = { id: string; name: string; code: string | null };
export type MetaVendor = { id: string; name: string; code: string };

export type CreateStaffClientBody = {
  companyName: string;
  contactEmail: string;
  locationId: string;
  operationalStatus?: string;
  externalBookingId: string;
  contactPersonName?: string;
  contactPhone?: string;
  address?: string;
  membershipType?: string;
  officeType?: string;
  leadSource?: string;
  notes?: string;
  contractMonths?: number;
  vendorId?: string;
  contractStartDate?: string;
  contractEndDate?: string;
};

export function fmtDate(v?: string | null): string {
  if (!v) return '—';
  return String(v).slice(0, 10);
}

export function lookupClients(q: string, limit = 30) {
  return apiGet<StaffClientCard[]>(
    `/mobile/clients/lookup?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
}

export function getClientStatus(id: string) {
  return apiGet<StaffClientCard>(`/mobile/clients/${id}/status`);
}

export function createClient(body: CreateStaffClientBody) {
  return apiPost<StaffClientCard>('/mobile/clients', body);
}

export function updateClient(
  id: string,
  body: {
    notes?: string;
    externalBookingId?: string;
    contractStartDate?: string;
    contractEndDate?: string;
  },
) {
  return apiPatch<StaffClientCard>(`/mobile/clients/${id}`, body);
}

export function listLocations() {
  return apiGet<MetaLocation[]>('/mobile/meta/locations');
}

export function listVendors(locationId?: string) {
  const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
  return apiGet<MetaVendor[]>(`/mobile/meta/vendors${q}`);
}

export function notifyMailReceived(
  clientId: string,
  imageBase64: string,
  mimeType: string,
  note?: string,
) {
  return apiPost<{ sent: boolean; to: string; receivedAtIst: string }>(
    `/mobile/clients/${clientId}/mail-notify`,
    {
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
      fileName: 'mail-received.jpg',
      ...(note?.trim() ? { note: note.trim() } : {}),
    },
  );
}

export function listRecentPayments(limit = 30) {
  return apiGet<unknown>(`/admin/payments?limit=${limit}`);
}

export function listRecentInvoices(limit = 30) {
  return apiGet<unknown>(`/admin/invoices?limit=${limit}`);
}

/** Read a File as base64 (no data: prefix). */
export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({
        base64,
        mimeType: file.type || 'image/jpeg',
        previewUrl: result.startsWith('data:') ? result : URL.createObjectURL(file),
      });
    };
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}
