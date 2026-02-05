import { apiGet } from './api';

/** Invoice as returned by client invoices list. */
export interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  gstNumber?: string | null;
  billingName: string;
  billingAddress: string;
  pdfUrl?: string | null;
  createdAt: string;
  payment?: {
    id: string;
    providerPaymentId?: string | null;
    paidAt?: string | null;
  };
}

/** Paginated invoices response. */
export interface ClientInvoicesListResponse {
  data: ClientInvoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get invoices for the current user's company.
 * Backend: GET /client/invoices (CLIENT).
 */
export async function getMyInvoices(params?: {
  page?: number;
  limit?: number;
}): Promise<ClientInvoicesListResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const path = qs ? `/client/invoices?${qs}` : '/client/invoices';
  return apiGet<ClientInvoicesListResponse>(path);
}

/**
 * Get download URL for invoice PDF.
 * Backend: GET /client/invoices/:invoiceId/download (CLIENT).
 */
export async function downloadMyInvoice(invoiceId: string): Promise<{ downloadUrl: string; fileName: string }> {
  return apiGet<{ downloadUrl: string; fileName: string }>(`/client/invoices/${invoiceId}/download`);
}
