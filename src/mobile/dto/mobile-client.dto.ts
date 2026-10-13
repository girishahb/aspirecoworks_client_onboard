import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const optionalString = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.string().optional(),
);

export const createMobileClientSchema = z.object({
  companyName: z.string().min(1),
  contactEmail: z.string().email().optional(),
  contactPhone: optionalString,
  contactPersonName: optionalString,
  contactPersonTitle: optionalString,
  contactPersonPhone: optionalString,
  address: optionalString,
  city: optionalString,
  taxId: optionalString,
  gstNumber: optionalString,
  membershipType: optionalString,
  officeType: optionalString,
  leadSource: optionalString,
  contractMonths: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().positive().max(600).optional(),
  ),
  locationId: z.string().uuid(),
  vendorId: z.string().uuid().optional(),
  contractStartDate: z.string().optional(), // YYYY-MM-DD
  contractEndDate: z.string().optional(),
  operationalStatus: z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'UNKNOWN']).optional(),
  notes: optionalString,
  externalBookingId: optionalString,
  aggregatorName: optionalString,
});

export class CreateMobileClientDto extends createZodDto(createMobileClientSchema) {}

export const updateMobileClientSchema = createMobileClientSchema.partial().omit({ locationId: true }).extend({
  locationId: z.string().uuid().optional(),
});

export class UpdateMobileClientDto extends createZodDto(updateMobileClientSchema) {}
