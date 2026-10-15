import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const DUPLICATE_EXTERNAL_BOOKING_ID_MESSAGE =
  'This booking ID already exists. Kindly resubmit with a revised booking ID for this client.';

type ClientProfileFinder = {
  clientProfile: {
    findFirst: (args: {
      where: Prisma.ClientProfileWhereInput;
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

/** Trim; blank / null / undefined become null (allowed on many clients). */
export function normalizeExternalBookingId(
  value?: string | null,
): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

/**
 * Ensure no other client already uses this booking ID.
 * Returns the normalized value to persist (or null when clearing / blank).
 */
export async function assertExternalBookingIdAvailable(
  db: ClientProfileFinder,
  bookingId: string | null | undefined,
  excludeClientId?: string,
): Promise<string | null> {
  const normalized = normalizeExternalBookingId(bookingId);
  if (!normalized) return null;

  const existing = await db.clientProfile.findFirst({
    where: {
      externalBookingId: normalized,
      ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictException(DUPLICATE_EXTERNAL_BOOKING_ID_MESSAGE);
  }

  return normalized;
}

export function isExternalBookingIdUniqueViolation(
  err: unknown,
): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes('externalBookingId')
  );
}
