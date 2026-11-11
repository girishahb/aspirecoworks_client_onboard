import { BadRequestException } from '@nestjs/common';
import { Prisma, RenewalStatus } from '@prisma/client';
import {
  assertExternalBookingIdAvailable,
  normalizeExternalBookingId,
} from './external-booking-id.helper';

export type ContractTermSnapshot = {
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  externalBookingId: string | null;
};

export type ContractTermChangeInput = {
  /** Existing profile values before update. */
  existing: ContractTermSnapshot;
  /** Next start date if provided in the request; undefined = leave unchanged. */
  nextStart?: Date | null;
  /** Next end date if provided in the request; undefined = leave unchanged. */
  nextEnd?: Date | null;
  /**
   * Next booking ID if provided. When a term change is detected, a new
   * non-empty booking ID different from the current one is always required.
   */
  nextBookingId?: string | null;
  /** Whether the request included externalBookingId at all. */
  bookingIdProvided: boolean;
  /** Whether the request included contractStartDate. */
  startProvided: boolean;
  /** Whether the request included contractEndDate. */
  endProvided: boolean;
  clientId: string;
  changedById: string;
  note?: string | null;
};

export type ContractTermChangeResult = {
  /** True when previous term was archived and profile fields must change. */
  termChanged: boolean;
  historyCreate?: Prisma.ClientContractHistoryCreateWithoutClientProfileInput;
  profilePatch: {
    contractStartDate?: Date | null;
    contractEndDate?: Date | null;
    renewalDate?: Date | null;
    renewalStatus?: RenewalStatus | null;
    externalBookingId?: string | null;
  };
};

function ymdKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, '0');
  const day = String(x.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function datesEqual(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return ymdKey(a ?? null) === ymdKey(b ?? null);
}

/**
 * When start/end/booking ID change, archive the previous term and require a
 * brand-new booking ID. End date must be after start when both are set.
 */
export async function prepareContractTermChange(
  db: Parameters<typeof assertExternalBookingIdAvailable>[0],
  input: ContractTermChangeInput,
): Promise<ContractTermChangeResult> {
  const resolvedStart = input.startProvided
    ? (input.nextStart ?? null)
    : input.existing.contractStartDate;
  const resolvedEnd = input.endProvided
    ? (input.nextEnd ?? null)
    : input.existing.contractEndDate;

  const startChanged =
    input.startProvided && !datesEqual(input.existing.contractStartDate, resolvedStart);
  const endChanged =
    input.endProvided && !datesEqual(input.existing.contractEndDate, resolvedEnd);

  const requestedBooking = input.bookingIdProvided
    ? normalizeExternalBookingId(input.nextBookingId)
    : undefined;
  const existingBooking = normalizeExternalBookingId(input.existing.externalBookingId);
  const bookingChanged =
    input.bookingIdProvided && requestedBooking !== existingBooking;

  const termChanged = startChanged || endChanged || bookingChanged;

  if (!termChanged) {
    return { termChanged: false, profilePatch: {} };
  }

  if (resolvedStart && resolvedEnd && resolvedEnd.getTime() <= resolvedStart.getTime()) {
    throw new BadRequestException('Contract end date must be after start date.');
  }

  if (!input.bookingIdProvided || !requestedBooking) {
    throw new BadRequestException(
      'A new Booking ID is required whenever agreement dates or booking ID are updated.',
    );
  }

  if (requestedBooking === existingBooking) {
    throw new BadRequestException(
      'Enter a new Booking ID (different from the current one) when updating agreement dates or renewing.',
    );
  }

  const uniqueBookingId = await assertExternalBookingIdAvailable(
    db,
    requestedBooking,
    input.clientId,
  );

  const profilePatch: ContractTermChangeResult['profilePatch'] = {
    externalBookingId: uniqueBookingId,
  };

  if (input.startProvided) {
    profilePatch.contractStartDate = resolvedStart;
  }
  if (input.endProvided) {
    profilePatch.contractEndDate = resolvedEnd;
    profilePatch.renewalDate = resolvedEnd;
    if (resolvedEnd) {
      const today = new Date();
      const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      const endUtc = Date.UTC(
        resolvedEnd.getUTCFullYear(),
        resolvedEnd.getUTCMonth(),
        resolvedEnd.getUTCDate(),
      );
      profilePatch.renewalStatus =
        endUtc < todayUtc ? RenewalStatus.EXPIRED : RenewalStatus.ACTIVE;
    } else {
      profilePatch.renewalStatus = null;
    }
  }

  const historyCreate: Prisma.ClientContractHistoryCreateWithoutClientProfileInput = {
    contractStartDate: input.existing.contractStartDate,
    contractEndDate: input.existing.contractEndDate,
    externalBookingId: input.existing.externalBookingId,
    note: input.note?.trim() || null,
    changedBy: { connect: { id: input.changedById } },
  };

  return { termChanged: true, historyCreate, profilePatch };
}
