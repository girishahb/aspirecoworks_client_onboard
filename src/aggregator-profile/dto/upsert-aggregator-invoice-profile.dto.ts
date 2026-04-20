import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const upsertAggregatorInvoiceProfileSchema = z.object({
  legalName: z.string().trim().min(1, 'Legal name is required').max(255),
  constitution: z.string().trim().max(120).nullish().transform((v) => (v ? v : null)),
  gstin: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || GSTIN_REGEX.test(v), {
      message: 'GSTIN must be 15 characters in the standard format (e.g. 06AAECI1326G1ZZ)',
    }),
  pan: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || PAN_REGEX.test(v), {
      message: 'PAN must match the format AAAAA9999A',
    }),
  registeredAddress: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => (v ? v : null)),
});

export class UpsertAggregatorInvoiceProfileDto extends createZodDto(
  upsertAggregatorInvoiceProfileSchema,
) {}
