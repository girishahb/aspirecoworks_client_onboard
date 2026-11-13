import { apiGet, apiPatch, apiPost, apiPut } from './api';
import { apiUrl } from '../api/url';
import { getAuthHeaders, logout, setSessionExpired } from './auth';

export type TicketStatus = 'IN_PROGRESS' | 'CLOSED';
export type DeskView = 'mine' | 'queue' | 'closed';

export interface TicketListItem {
  id: string;
  ticketNumber: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  companyName: string;
  location: string;
  locationId: string;
  issueGroup: string;
  description: string;
  department: string | null;
  assignee: string | null;
  assignedUserId: string | null;
  status: TicketStatus;
}

export interface TicketPage {
  rows: TicketListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TicketEvent {
  id: string;
  type: string;
  createdAt: string;
  actorName: string | null;
  details: Record<string, unknown> | null;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedById: string | null;
}

export interface TicketDetail {
  id: string;
  ticketNumber: string;
  customerName: string;
  companyName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  location: { id: string; name: string };
  issueGroup: { id: string; name: string };
  issueDescription: string;
  status: TicketStatus;
  department: { id: string; name: string } | null;
  assignee: { id: string; name: string; email: string } | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  qrLabel: string;
  events: TicketEvent[];
  attachments: TicketAttachment[];
  notifications: {
    id: string;
    kind: string;
    status: string;
    error: string | null;
    attempt: number;
    createdAt: string;
    sentAt: string | null;
    toEmails: string[];
  }[];
}

export interface DeskSummary {
  assignedToMe: number;
  branchQueue: number;
  inProgress: number;
  closed: number;
  homeLocation: { id: string; name: string } | null;
  showingAllBranches: boolean;
}

export interface Colleague {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface SupportSettings {
  departments: { id: string; name: string }[];
  groups: {
    id: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
    route: {
      id: string;
      departmentId: string;
      departmentName: string;
      defaultAssigneeId: string | null;
      assigneeName: string | null;
      toEmails: string[];
      ccEmails: string[];
    } | null;
  }[];
  locations: { id: string; name: string; code: string | null }[];
  qrCodes: {
    id: string;
    label: string;
    isActive: boolean;
    locationId: string;
    locationName: string;
    url: string;
    createdAt: string;
  }[];
  receptionUsers: {
    id: string;
    name: string;
    email: string;
    homeLocationId: string | null;
    homeLocationName: string | null;
  }[];
  unconfiguredGroups: string[];
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function canWorkTickets(role?: string | null): boolean {
  return ['RECEPTION', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes((role || '').toUpperCase());
}

export function getPublicTicketForm(token: string) {
  return publicJson<{ locationName: string; groups: { id: string; name: string }[] }>(
    `/public/support/form?t=${encodeURIComponent(token)}`,
  );
}

export function submitPublicTicket(body: {
  token: string;
  customerName: string;
  companyName: string;
  issueGroupId: string;
  issueDescription: string;
  customerEmail?: string;
  customerPhone?: string;
  clientRequestId: string;
  website?: string;
  attachment?: { fileName: string; contentBase64: string };
}) {
  return publicJson<{ ticketNumber: string; message: string }>(`/public/support/tickets`, {
    method: 'POST',
    body,
  });
}

export function getDeskSummary() {
  return apiGet<DeskSummary>('/staff/support/summary');
}

export function listDeskTickets(opts: { view: DeskView; q?: string; page?: number }) {
  return apiGet<TicketPage>(
    `/staff/support/tickets${qs({
      view: opts.view,
      q: opts.q,
      page: opts.page ? String(opts.page) : undefined,
    })}`,
  );
}

export function getStaffTicket(id: string) {
  return apiGet<TicketDetail>(`/staff/support/tickets/${id}`);
}

export function commentStaffTicket(id: string, body: string) {
  return apiPost<TicketDetail>(`/staff/support/tickets/${id}/comments`, { body });
}

export function takeStaffTicket(id: string) {
  return apiPost<TicketDetail>(`/staff/support/tickets/${id}/take`, {});
}

export function assignStaffTicket(id: string, assigneeId: string, reason: string) {
  return apiPost<TicketDetail>(`/staff/support/tickets/${id}/assign`, { assigneeId, reason });
}

export function closeStaffTicket(id: string, resolutionNotes: string) {
  return apiPost<TicketDetail>(`/staff/support/tickets/${id}/close`, { resolutionNotes });
}

export function attachStaffTicket(id: string, fileName: string, contentBase64: string) {
  return apiPost<TicketDetail>(`/staff/support/tickets/${id}/attachments`, { fileName, contentBase64 });
}

export function listStaffColleagues() {
  return apiGet<Colleague[]>('/staff/support/colleagues');
}

export function getAdminTicketSummary() {
  return apiGet<{
    total: number;
    inProgress: number;
    closed: number;
    createdToday: number;
    closedToday: number;
    unassigned: number;
    unconfiguredGroups: string[];
    locations: { id: string; name: string }[];
    groups: { id: string; name: string }[];
  }>('/admin/support/summary');
}

export function listAdminTickets(opts: {
  q?: string;
  locationId?: string;
  issueGroupId?: string;
  status?: string;
  from?: string;
  to?: string;
  unassigned?: string;
  page?: number;
}) {
  return apiGet<TicketPage>(
    `/admin/support/tickets${qs({
      q: opts.q,
      locationId: opts.locationId,
      issueGroupId: opts.issueGroupId,
      status: opts.status,
      from: opts.from,
      to: opts.to,
      unassigned: opts.unassigned,
      page: opts.page ? String(opts.page) : undefined,
    })}`,
  );
}

export function getAdminTicket(id: string) {
  return apiGet<TicketDetail>(`/admin/support/tickets/${id}`);
}

export function commentAdminTicket(id: string, body: string) {
  return apiPost<TicketDetail>(`/admin/support/tickets/${id}/comments`, { body });
}

export function takeAdminTicket(id: string) {
  return apiPost<TicketDetail>(`/admin/support/tickets/${id}/take`, {});
}

export function assignAdminTicket(id: string, assigneeId: string, reason: string) {
  return apiPost<TicketDetail>(`/admin/support/tickets/${id}/assign`, { assigneeId, reason });
}

export function closeAdminTicket(id: string, resolutionNotes: string) {
  return apiPost<TicketDetail>(`/admin/support/tickets/${id}/close`, { resolutionNotes });
}

export function reopenAdminTicket(id: string, reason: string) {
  return apiPost<TicketDetail>(`/admin/support/tickets/${id}/reopen`, { reason });
}

export function attachAdminTicket(id: string, fileName: string, contentBase64: string) {
  return apiPost<TicketDetail>(`/admin/support/tickets/${id}/attachments`, { fileName, contentBase64 });
}

export function listAdminColleagues() {
  return apiGet<Colleague[]>('/admin/support/colleagues');
}

export function getSupportSettings() {
  return apiGet<SupportSettings>('/admin/support/settings');
}

export function createIssueGroup(name: string) {
  return apiPost<SupportSettings>('/admin/support/groups', { name });
}

export function updateIssueGroup(id: string, body: { name?: string; isActive?: boolean }) {
  return apiPatch<SupportSettings>(`/admin/support/groups/${id}`, body);
}

export function saveIssueRoute(
  id: string,
  body: {
    departmentId: string;
    defaultAssigneeId?: string | null;
    toEmails: string[];
    ccEmails: string[];
  },
) {
  return apiPut<SupportSettings>(`/admin/support/groups/${id}/route`, body);
}

export function createQrCode(locationId: string, label?: string) {
  return apiPost<{ id: string; url: string }>('/admin/support/qr', { locationId, label });
}

export function setQrActive(id: string, isActive: boolean) {
  return apiPatch<SupportSettings>(`/admin/support/qr/${id}`, { isActive });
}

export function regenerateQrCode(id: string) {
  return apiPost<{ id: string; url: string }>(`/admin/support/qr/${id}/regenerate`, {});
}

export function setReceptionHome(userId: string, locationId: string | null) {
  return apiPatch<SupportSettings>(`/admin/support/reception/${userId}/location`, { locationId });
}

export async function downloadTicketExport(opts: Record<string, string | undefined>) {
  const res = await fetch(apiUrl(`/admin/support/tickets/export${qs(opts)}`), {
    headers: { ...getAuthHeaders() },
  });
  if (res.status === 401) {
    setSessionExpired();
    logout();
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'support-tickets.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadQrPoster(id: string, fileName: string) {
  await downloadAuthFile(`/admin/support/qr/${id}/poster`, fileName);
}

export async function downloadAllQrPosters() {
  await downloadAuthFile('/admin/support/qr/posters', 'aspire-support-posters.pdf');
}

async function downloadAuthFile(path: string, fileName: string) {
  const res = await fetch(apiUrl(path), { headers: { ...getAuthHeaders() } });
  if (res.status === 401) {
    setSessionExpired();
    logout();
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
export async function downloadQrImage(id: string, format: 'png' | 'svg', fileName: string) {
  await downloadAuthFile(`/admin/support/qr/${id}/image?format=${format}`, fileName);
}

export async function fetchTicketAttachmentUrl(
  scope: 'staff' | 'admin',
  ticketId: string,
  attachmentId: string,
): Promise<string> {
  const res = await fetch(apiUrl(`/${scope}/support/tickets/${ticketId}/attachments/${attachmentId}`), {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) throw new Error('Could not open the file');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function publicJson<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : 'Request failed';
    throw new Error(message);
  }
  return data as T;
}
