import { apiGet, apiPost } from './api';

export interface AggregatorUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'AGGREGATOR';
  aggregatorName: string | null;
  isActive: boolean;
  isActivated: boolean;
  createdAt: string;
  updatedAt: string;
  clientsCount?: number;
}

export interface CreateAggregatorUserInput {
  firstName: string;
  lastName: string;
  email: string;
  aggregatorName: string;
}

export async function listAggregatorUsers(): Promise<AggregatorUser[]> {
  return apiGet<AggregatorUser[]>('/admin/aggregator-users');
}

export async function createAggregatorUser(input: CreateAggregatorUserInput): Promise<AggregatorUser> {
  return apiPost<AggregatorUser>('/admin/aggregator-users', input);
}

export async function resendAggregatorInvite(
  userId: string,
): Promise<{ sent: boolean; message: string }> {
  return apiPost<{ sent: boolean; message: string }>(
    `/admin/aggregator-users/${userId}/resend-invite`,
  );
}
