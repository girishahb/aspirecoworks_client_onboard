import { apiGet, apiPost, apiPatch } from './api';

export type MobileOpsRole = 'RECEPTION' | 'STAFF' | 'FINANCE';

export type MobileOpsUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: MobileOpsRole;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

export async function listMobileOpsUsers() {
  return apiGet<MobileOpsUser[]>('/users/mobile-ops');
}

export async function createMobileOpsUser(body: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: MobileOpsRole;
}) {
  return apiPost<MobileOpsUser>('/users/mobile-ops', body);
}

export async function setUserActive(id: string, isActive: boolean) {
  return apiPatch<MobileOpsUser>(`/users/${id}/active`, { isActive });
}
