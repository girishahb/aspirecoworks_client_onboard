import { apiGet, apiPatch, apiPost, apiRequest } from './api';

/** Company (client profile) as returned by admin list/get. */
export interface AdminCompany {
  id: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  onboardingStage?: string;
  activationDate?: string | null;
  renewalDate?: string | null;
  renewalStatus?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { id: string; email: string; firstName?: string; lastName?: string };
  _count?: { documents?: number };
  documents?: AdminDocumentListItem[];
  [key: string]: unknown;
}

/** Document as returned by admin list. */
export interface AdminDocumentListItem {
  id: string;
  fileName: string;
  documentType: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  adminRemarks?: string | null;
  version?: number;
  [key: string]: unknown;
}

/**
 * List all companies (client profiles).
 * Backend: GET /client-profiles (ADMIN, MANAGER, CLIENT with filtering).
 */
export async function listCompanies(): Promise<AdminCompany[]> {
  return apiGet<AdminCompany[]>('/client-profiles');
}

/**
 * Get a single company by ID.
 * Backend: GET /client-profiles/:id.
 */
export async function getCompany(companyId: string): Promise<AdminCompany> {
  return apiGet<AdminCompany>(`/client-profiles/${companyId}`);
}

/**
 * Create a new client profile (company).
 * Backend: POST /client-profiles (ADMIN, MANAGER).
 */
export async function createCompany(data: {
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  taxId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
}): Promise<AdminCompany> {
  return apiPost<AdminCompany>('/client-profiles', data);
}

/**
 * List documents for a company.
 * Backend: GET /documents/company/:companyId (SUPER_ADMIN).
 */
export async function listCompanyDocuments(companyId: string): Promise<AdminDocumentListItem[]> {
  return apiGet<AdminDocumentListItem[]>(`/documents/company/${companyId}`);
}

/**
 * Get presigned upload URL for admin to upload an agreement draft for a company.
 * Backend: POST /documents/admin/agreement-draft-upload-url (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function getAdminAgreementDraftUploadUrl(
  companyId: string,
  file: { name: string; size: number; type?: string },
): Promise<{ documentId: string; uploadUrl: string; expiresIn: number }> {
  return apiPost<{ documentId: string; uploadUrl: string; expiresIn: number }>(
    '/documents/admin/agreement-draft-upload-url',
    {
      companyId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || undefined,
    },
  );
}

/**
 * Notify client and set company stage to AGREEMENT_DRAFT_SHARED after agreement draft upload.
 * Call after uploading the file to the presigned URL.
 * Backend: POST /documents/:id/notify-agreement-draft-shared (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function notifyAgreementDraftShared(documentId: string): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>(
    `/documents/${documentId}/notify-agreement-draft-shared`,
  );
}

/**
 * Upload agreement draft file for a company via proxy (avoids CORS).
 * Supports .pdf, .doc, .docx.
 */
export async function uploadAgreementDraft(companyId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('companyId', companyId);

  const res = await apiRequest('/documents/admin/agreement-draft-upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new Error(message || `Upload failed (${res.status})`);
  }
}

/**
 * Get presigned upload URL for admin to upload final agreement for a company.
 * Backend: POST /documents/admin/agreement-final-upload-url (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function getAdminAgreementFinalUploadUrl(
  companyId: string,
  file: { name: string; size: number; type?: string },
): Promise<{ documentId: string; uploadUrl: string; expiresIn: number }> {
  return apiPost<{ documentId: string; uploadUrl: string; expiresIn: number }>(
    '/documents/admin/agreement-final-upload-url',
    {
      companyId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || undefined,
    },
  );
}

/**
 * Notify client and set company stage to FINAL_AGREEMENT_SHARED after final agreement upload.
 * Backend: POST /documents/:id/notify-agreement-final-shared (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function notifyAgreementFinalShared(documentId: string): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>(
    `/documents/${documentId}/notify-agreement-final-shared`,
  );
}

/**
 * Upload final agreement file for a company via proxy (avoids CORS).
 */
export async function uploadFinalAgreement(companyId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('companyId', companyId);

  const res = await apiRequest('/documents/admin/agreement-final-upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new Error(message || `Upload failed (${res.status})`);
  }
}

export interface ReviewDocumentPayload {
  status: 'VERIFIED' | 'REJECTED' | 'PENDING_WITH_CLIENT';
  rejectionReason?: string;
  adminRemarks?: string;
}

/**
 * Review a document: Approve, Reject (with reason), or Mark Pending with Client. Optional adminRemarks stored for all actions.
 * Backend: PATCH /documents/:id/review (SUPER_ADMIN).
 */
export async function reviewDocument(
  documentId: string,
  payload: ReviewDocumentPayload,
): Promise<unknown> {
  return apiPatch(`/documents/${documentId}/review`, payload);
}

/**
 * Approve a document (set status to VERIFIED). Optional admin remarks.
 */
export async function approveDocument(
  documentId: string,
  adminRemarks?: string,
): Promise<unknown> {
  return reviewDocument(documentId, {
    status: 'VERIFIED',
    ...(adminRemarks?.trim() && { adminRemarks: adminRemarks.trim() }),
  });
}

/**
 * Reject a document with a reason. Optional admin remarks.
 */
export async function rejectDocument(
  documentId: string,
  reason: string,
  adminRemarks?: string,
): Promise<unknown> {
  return reviewDocument(documentId, {
    status: 'REJECTED',
    rejectionReason: reason.trim(),
    ...(adminRemarks?.trim() && { adminRemarks: adminRemarks.trim() }),
  });
}

/**
 * Mark document as Pending with Client (sent back for re-upload or action). Optional admin remarks.
 */
export async function markDocumentPendingWithClient(
  documentId: string,
  adminRemarks?: string,
): Promise<unknown> {
  return reviewDocument(documentId, {
    status: 'PENDING_WITH_CLIENT',
    ...(adminRemarks?.trim() && { adminRemarks: adminRemarks.trim() }),
  });
}

/**
 * Update company onboarding stage (SUPER_ADMIN, ADMIN, MANAGER).
 * Backend: PATCH /client-profiles/:id/status with { stage }.
 */
export async function updateCompanyStage(
  companyId: string,
  stage: string,
): Promise<unknown> {
  return apiPatch(`/client-profiles/${companyId}/status`, { stage });
}

/**
 * Activate company after agreement completion.
 * Only allowed when stage is FINAL_AGREEMENT_SHARED. Sets activationDate, stage to ACTIVE, sends activation email.
 * Backend: POST /client-profiles/:id/activate (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function activateCompany(companyId: string): Promise<unknown> {
  return apiPost(`/client-profiles/${companyId}/activate`);
}

/** Compliance status for a company (required docs, approved docs, isCompliant). */
export interface ComplianceStatus {
  companyId: string;
  requiredDocumentTypes: string[];
  approvedDocumentTypes: string[];
  missingDocumentTypes: string[];
  isCompliant: boolean;
}

/**
 * Get compliance status for a company (required documents vs approved).
 * Backend: GET /compliance/company/:companyId (SUPER_ADMIN).
 */
export async function getComplianceStatus(companyId: string): Promise<ComplianceStatus> {
  return apiGet<ComplianceStatus>(`/compliance/company/${companyId}`);
}

/** Single audit log entry as returned by the API. */
export interface AuditLogEntry {
  id: string;
  userId: string | null;
  clientProfileId: string | null;
  documentId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; email: string; firstName?: string; lastName?: string } | null;
  clientProfile?: { id: string; companyName: string } | null;
  document?: { id: string; fileName: string } | null;
}

export interface ListAuditLogsParams {
  userId?: string;
  clientProfileId?: string;
  documentId?: string;
  entityType?: string;
}

/**
 * List audit logs (read-only). Supports optional filters.
 * Backend: GET /audit-logs (ADMIN, MANAGER).
 */
export async function listAuditLogs(params?: ListAuditLogsParams): Promise<AuditLogEntry[]> {
  const search = new URLSearchParams();
  if (params?.userId) search.set('userId', params.userId);
  if (params?.clientProfileId) search.set('clientProfileId', params.clientProfileId);
  if (params?.documentId) search.set('documentId', params.documentId);
  if (params?.entityType) search.set('entityType', params.entityType);
  const qs = search.toString();
  const path = qs ? `/audit-logs?${qs}` : '/audit-logs';
  return apiGet<AuditLogEntry[]>(path);
}

/** Dashboard statistics returned by GET /admin/dashboard/stats. */
export interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  paymentPending: number;
  kycPending: number;
  agreementsPending: number;
  readyForActivation: number;
  totalRevenue: number;
  revenueThisMonth: number;
  stageCounts: Record<string, number>;
}

/**
 * Get admin dashboard statistics (company counts, revenue, stage distribution).
 * Backend: GET /admin/dashboard/stats (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/admin/dashboard/stats');
}

/** Payment as returned by admin payments list. */
export interface AdminPayment {
  id: string;
  companyId: string;
  companyName: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'PAID' | 'FAILED';
  provider: string;
  providerPaymentId?: string | null;
  paymentLink?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

/** Paginated payments response. */
export interface PaymentsListResponse {
  data: AdminPayment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Company payment history response. */
export interface CompanyPaymentHistory {
  companyId: string;
  companyName: string;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: 'CREATED' | 'PAID' | 'FAILED';
    provider: string;
    providerPaymentId?: string | null;
    paymentLink?: string | null;
    paidAt?: string | null;
    createdAt: string;
  }>;
}

export interface ListPaymentsParams {
  status?: 'CREATED' | 'PAID' | 'FAILED';
  companyId?: string;
  fromDate?: string; // ISO date string
  toDate?: string; // ISO date string
  page?: number;
  limit?: number;
}

/**
 * List all payments with optional filters.
 * Backend: GET /admin/payments (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function listPayments(params?: ListPaymentsParams): Promise<PaymentsListResponse> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.companyId) search.set('companyId', params.companyId);
  if (params?.fromDate) search.set('fromDate', params.fromDate);
  if (params?.toDate) search.set('toDate', params.toDate);
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const path = qs ? `/admin/payments?${qs}` : '/admin/payments';
  return apiGet<PaymentsListResponse>(path);
}

/**
 * Get payment history for a company.
 * Backend: GET /admin/payments/companies/:companyId (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function getCompanyPaymentHistory(companyId: string): Promise<CompanyPaymentHistory> {
  return apiGet<CompanyPaymentHistory>(`/admin/payments/companies/${companyId}`);
}

/**
 * Resend payment link to company.
 * Backend: POST /admin/payments/:paymentId/resend-link (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function resendPaymentLink(paymentId: string): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>(`/admin/payments/${paymentId}/resend-link`);
}

/** Invoice as returned by admin invoices list. */
export interface AdminInvoice {
  id: string;
  companyId: string;
  paymentId: string;
  invoiceNumber: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  gstNumber?: string | null;
  billingName: string;
  billingAddress: string;
  pdfUrl?: string | null;
  createdAt: string;
  company?: {
    id: string;
    companyName: string;
  };
  payment?: {
    id: string;
    providerPaymentId?: string | null;
    paidAt?: string | null;
  };
}

/** Paginated invoices response. */
export interface InvoicesListResponse {
  data: AdminInvoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListInvoicesParams {
  companyId?: string;
  page?: number;
  limit?: number;
}

/**
 * List all invoices with optional filters.
 * Backend: GET /admin/invoices (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function listInvoices(params?: ListInvoicesParams): Promise<InvoicesListResponse> {
  const search = new URLSearchParams();
  if (params?.companyId) search.set('companyId', params.companyId);
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const path = qs ? `/admin/invoices?${qs}` : '/admin/invoices';
  return apiGet<InvoicesListResponse>(path);
}

/**
 * Get download URL for invoice PDF.
 * Backend: GET /admin/invoices/:invoiceId/download (SUPER_ADMIN, ADMIN, MANAGER).
 */
export async function downloadInvoice(invoiceId: string): Promise<{ downloadUrl: string; fileName: string }> {
  return apiGet<{ downloadUrl: string; fileName: string }>(`/admin/invoices/${invoiceId}/download`);
}
