import { apiDelete, apiGet, apiPut } from './api';

/**
 * Allowed plan types for an aggregator booking. Kept in sync with the backend
 * Zod schema (see `aggregator-booking-input.ts`).
 */
export const AGGREGATOR_BOOKING_PLAN_TYPES = [
  'GR',
  'BR',
  'Mailing Address',
  'Dedicated desk',
  'Shared desk',
] as const;

export type AggregatorBookingPlanType =
  (typeof AGGREGATOR_BOOKING_PLAN_TYPES)[number];

/** Fixed venue brand for aggregator registrations (agreements / booking display). */
export const DEFAULT_AGGREGATOR_VENUE_NAME = 'Aspire Coworks';

export interface AggregatorVenueLocation {
  id: string;
  label: string;
  address: string;
}

/**
 * Selectable Aspire Coworks locations for aggregator booking venue address.
 * `address` is stored on AggregatorBooking.venueAddress as the full legal line.
 */
export const AGGREGATOR_VENUE_LOCATIONS: readonly AggregatorVenueLocation[] = [
  {
    id: 'indiranagar-7th-main-3rd',
    label: 'Indiranagar — 7th Main (3rd floor, Appareddy Palya)',
    address:
      'No. 39/7-1, Third (3rd) Floor, 7th Main, Opposite Dr. Ambedkar College Ground, Appareddy Palya, Indiranagar, Bengaluru North – 560038',
  },
  {
    id: 'indiranagar-ii-stage',
    label: 'Indiranagar — II Stage (7th Main Road)',
    address:
      'No. 17, 2nd floor, 7th Main Road, II Stage, Indiranagar, Bangalore 560038',
  },
  {
    id: 'koramangala-ejipura',
    label: 'Koramangala 4th Block — Ejipura / AVS Layout',
    address:
      'No. 472/7 Balaji Arcade, 2nd & 3rd Floor, A.V.S. Compound, 20th L Cross Road, AVS Layout, Ejipura, Koramangala 4th Block, Bengaluru, Karnataka – 560095',
  },
] as const;

export interface AggregatorInvoiceProfile {
  id: string;
  userId: string;
  legalName: string;
  constitution: string | null;
  gstin: string | null;
  pan: string | null;
  registeredAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAggregatorInvoiceProfileInput {
  legalName: string;
  constitution?: string | null;
  gstin?: string | null;
  pan?: string | null;
  registeredAddress?: string | null;
}

export async function getMyInvoiceProfile(): Promise<AggregatorInvoiceProfile | null> {
  return apiGet<AggregatorInvoiceProfile | null>('/aggregator/invoice-profile');
}

export async function upsertMyInvoiceProfile(
  input: UpsertAggregatorInvoiceProfileInput,
): Promise<AggregatorInvoiceProfile> {
  return apiPut<AggregatorInvoiceProfile>('/aggregator/invoice-profile', input);
}

export async function deleteMyInvoiceProfile(): Promise<{ deleted: true }> {
  return apiDelete<{ deleted: true }>('/aggregator/invoice-profile');
}

export interface AggregatorBooking {
  id: string;
  clientProfileId: string;
  createdById: string;
  bookingReference: string | null;
  planType: AggregatorBookingPlanType | null;
  venueName: string | null;
  venueAddress: string | null;
  durationMonths: number | null;
  amount: string | null; // Decimal serialized as string
  currency: string;
  gstApplicable: boolean;
  paymentTerms: string | null;
  signageTerms: string | null;
  clientContactName: string | null;
  pocName: string | null;
  pocContact: string | null;
  clientFatherOrSpouseName: string | null;
  clientPan: string | null;
  clientAadhaar: string | null;
  invoiceLegalName: string | null;
  invoiceConstitution: string | null;
  invoiceGstin: string | null;
  invoicePan: string | null;
  invoiceRegisteredAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listCompanyBookings(companyId: string): Promise<AggregatorBooking[]> {
  return apiGet<AggregatorBooking[]>(`/client-profiles/${companyId}/bookings`);
}
