export const OFFICE_TYPE_OPTIONS = ['Virtual', 'Physical'] as const;
export const LEAD_SOURCE_OPTIONS = ['Aggregator', 'Direct'] as const;
export const MEMBERSHIP_TYPE_OPTIONS = [
  'GST Registration Plan (G.R)',
  'Business Registration (B.R)',
  'Mailing Address (M.A)',
] as const;
export const OPERATIONAL_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'PENDING', 'UNKNOWN'] as const;

export type ClientChannel = 'DIRECT' | 'AGGREGATOR';

export function leadSourceToChannel(leadSource: string): ClientChannel {
  return leadSource.trim().toLowerCase() === 'direct' ? 'DIRECT' : 'AGGREGATOR';
}

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
