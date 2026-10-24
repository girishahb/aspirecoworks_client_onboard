/**
 * Account active/inactive from agreement dates (Asia/Kolkata calendar days).
 * Same rule as mobile / backend agreement-status util.
 */

export function todayIstYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function dateOnlyYmd(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d).trim();
  return s.length >= 10 ? s.slice(0, 10) : null;
}

export function isActiveFromAgreement(
  p: {
    contractStartDate?: string | Date | null;
    contractEndDate?: string | Date | null;
  },
  now: Date = new Date(),
): boolean {
  const today = todayIstYmd(now);
  const start = dateOnlyYmd(p.contractStartDate);
  const end = dateOnlyYmd(p.contractEndDate);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

export type DeskClientStatus = 'active' | 'inactive' | 'pending' | 'expired';

/**
 * Desk status badge aligned with mobile agreement dates.
 * - expired: end date before today
 * - pending: start date after today (not started yet)
 * - inactive: rejected, or otherwise outside active window
 * - active: within start/end window (missing dates count as open-ended)
 */
export function deskClientStatus(company: {
  contractStartDate?: string | Date | null;
  contractEndDate?: string | Date | null;
  onboardingStage?: string | null;
}): DeskClientStatus {
  if (company.onboardingStage === 'REJECTED') return 'inactive';

  const today = todayIstYmd();
  const start = dateOnlyYmd(company.contractStartDate);
  const end = dateOnlyYmd(company.contractEndDate);

  if (end && end < today) return 'expired';
  if (start && start > today) return 'pending';
  if (isActiveFromAgreement(company)) return 'active';
  return 'inactive';
}
