import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStage } from '../../common/enums/onboarding-stage.enum';

export const ClientChannelEnum = z.enum(['DIRECT', 'AGGREGATOR']);

const optionalString = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.string().optional(),
);

/** UUID, empty string to clear relation, or omit to leave unchanged. */
const optionalUuidOrClear = z
  .union([z.string().uuid(), z.literal('')])
  .optional();

export const updateClientProfileSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').optional(),
  contactEmail: z.string().email('Invalid email format').optional(),
  contactPhone: optionalString,
  taxId: optionalString,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  country: optionalString,
  onboardingStage: z.nativeEnum(OnboardingStage).optional(),
  notes: optionalString,
  clientChannel: ClientChannelEnum.optional(),
  aggregatorName: optionalString,
  locationId: optionalUuidOrClear,
  vendorId: optionalUuidOrClear,
  membershipType: optionalString,
  officeType: optionalString,
  leadSource: optionalString,
  contractMonths: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().positive().max(600).optional(),
  ),
  contactPersonName: optionalString,
  contactPersonTitle: optionalString,
  contactPersonPhone: optionalString,
  gstNumber: optionalString,
  externalBookingId: optionalString,
  contractStartDate: optionalString,
  contractEndDate: optionalString,
  operationalStatus: z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'UNKNOWN']).optional(),
});

export class UpdateClientProfileDto extends createZodDto(updateClientProfileSchema) {}
