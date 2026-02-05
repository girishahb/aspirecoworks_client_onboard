import { apiGet } from './api';

export interface ClientPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'PAID' | 'FAILED';
  provider: string;
  providerPaymentId?: string | null;
  paymentLink?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

/**
 * Get payment history for the current user's company.
 * Backend: GET /payments/me (requires CLIENT with companyId).
 */
export async function getMyPayments(): Promise<ClientPayment[]> {
  return apiGet<ClientPayment[]>('/payments/me');
}
