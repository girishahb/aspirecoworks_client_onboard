/** Shared dropdown options for branch ops / Excel-aligned client fields. */

export const OFFICE_TYPE_OPTIONS = ['Virtual', 'Physical'] as const;

export const LEAD_SOURCE_OPTIONS = ['Aggregator', 'Direct'] as const;

export const MEMBERSHIP_TYPE_OPTIONS = [
  'GST Registration Plan (G.R)',
  'Business Registration (B.R)',
  'Mailing Address (M.A)',
] as const;

export const CONTRACT_MONTHS_OPTIONS = [1, 3, 6, 12, 24] as const;

export function leadSourceToClientChannel(
  leadSource: string | null | undefined,
): 'DIRECT' | 'AGGREGATOR' {
  const s = (leadSource || '').trim().toLowerCase();
  if (s === 'direct') return 'DIRECT';
  if (s === 'aggregator') return 'AGGREGATOR';
  return 'DIRECT';
}
