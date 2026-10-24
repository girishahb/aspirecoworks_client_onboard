/**
 * Account active/inactive from agreement dates (Asia/Kolkata calendar days).
 * Matches mobile reception/staff client list behaviour.
 *
 * Active when today is on/after start (if set) and on/before end (if set).
 * Missing start or end does not block activity on that side.
 */

export function todayIstYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function dateOnlyYmd(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d).trim();
  return s.length >= 10 ? s.slice(0, 10) : null;
}

export function isActiveFromAgreement(p: {
  contractStartDate?: Date | string | null;
  contractEndDate?: Date | string | null;
}, now: Date = new Date()): boolean {
  const today = todayIstYmd(now);
  const start = dateOnlyYmd(p.contractStartDate);
  const end = dateOnlyYmd(p.contractEndDate);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

export function agreementOperationalStatus(p: {
  contractStartDate?: Date | string | null;
  contractEndDate?: Date | string | null;
}, now: Date = new Date()): 'ACTIVE' | 'INACTIVE' {
  return isActiveFromAgreement(p, now) ? 'ACTIVE' : 'INACTIVE';
}

/** Midnight UTC for the given IST calendar day (YYYY-MM-DD). */
export function istYmdToUtcDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export type DeskStatusFilter = 'active' | 'inactive' | 'pending' | 'expired';

/**
 * Prisma where fragment matching deskClientStatus / mobile agreement rules.
 */
export function agreementStatusWhere(
  status: DeskStatusFilter,
  now: Date = new Date(),
): Record<string, unknown> {
  const today = istYmdToUtcDate(todayIstYmd(now));
  switch (status) {
    case 'expired':
      return { contractEndDate: { lt: today } };
    case 'pending':
      return {
        contractStartDate: { gt: today },
        OR: [{ contractEndDate: null }, { contractEndDate: { gte: today } }],
      };
    case 'inactive':
      return { onboardingStage: 'REJECTED' };
    case 'active':
    default:
      return {
        NOT: { onboardingStage: 'REJECTED' },
        AND: [
          { OR: [{ contractStartDate: null }, { contractStartDate: { lte: today } }] },
          { OR: [{ contractEndDate: null }, { contractEndDate: { gte: today } }] },
        ],
      };
  }
}
