import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const emptyToNull = (v: unknown) => (v === '' || v === undefined || v === null ? null : v);

/**
 * Invoice-To override provided on a specific registration. All fields optional –
 * when omitted, values fall back to the aggregator's saved invoice profile.
 */
export const invoiceToOverrideSchema = z
  .object({
    legalName: z.preprocess(emptyToNull, z.string().trim().max(255).nullable().optional()),
    constitution: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
    gstin: z
      .preprocess(
        (v) => (typeof v === 'string' ? v.trim().toUpperCase() : emptyToNull(v)),
        z.string().nullable().optional(),
      )
      .refine(
        (v) => v == null || v === '' || GSTIN_REGEX.test(v),
        {
          message: 'GSTIN must be 15 characters in the standard format (e.g. 06AAECI1326G1ZZ)',
        },
      ),
    pan: z
      .preprocess(
        (v) => (typeof v === 'string' ? v.trim().toUpperCase() : emptyToNull(v)),
        z.string().nullable().optional(),
      )
      .refine((v) => v == null || v === '' || PAN_REGEX.test(v), {
        message: 'PAN must match the format AAAAA9999A',
      }),
    registeredAddress: z.preprocess(
      emptyToNull,
      z.string().trim().max(1000).nullable().optional(),
    ),
  })
  .strict();

/**
 * Optional booking payload attached to a new aggregator-onboarded client.
 * Applied only when the caller is an AGGREGATOR (and silently ignored otherwise).
 */
export const aggregatorBookingInputSchema = z
  .object({
    bookingReference: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
    planType: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
    venueName: z.preprocess(emptyToNull, z.string().trim().max(255).nullable().optional()),
    venueAddress: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
    durationMonths: z
      .preprocess(
        (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
        z.number().int().min(1).max(120).nullable().optional(),
      ),
    amount: z
      .preprocess(
        (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
        z.number().min(0).nullable().optional(),
      ),
    currency: z.preprocess(emptyToNull, z.string().trim().length(3).nullable().optional()),
    gstApplicable: z.boolean().optional(),
    paymentTerms: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
    signageTerms: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
    clientContactName: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
    pocName: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
    pocContact: z.preprocess(emptyToNull, z.string().trim().max(60).nullable().optional()),
  })
  .strict();

export type AggregatorBookingInput = z.infer<typeof aggregatorBookingInputSchema>;
export type InvoiceToOverrideInput = z.infer<typeof invoiceToOverrideSchema>;
