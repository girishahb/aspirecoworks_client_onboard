import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStage } from '../../common/enums/onboarding-stage.enum';
import {
  aggregatorBookingInputSchema,
  invoiceToOverrideSchema,
} from './aggregator-booking-input';

// Helper to transform empty strings to undefined for optional fields
const optionalString = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.string().optional()
);

export const ClientChannelEnum = z.enum(['DIRECT', 'AGGREGATOR']);

export const createClientProfileSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactEmail: z.string().email('Invalid email format'),
  contactPhone: optionalString,
  taxId: optionalString,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  country: optionalString,
  onboardingStage: z.nativeEnum(OnboardingStage).default(OnboardingStage.ADMIN_CREATED).optional(),
  notes: optionalString,
  clientChannel: ClientChannelEnum.optional(),
  aggregatorName: optionalString,
  /**
   * Aggregator-only: optional booking details for this registration.
   * Silently ignored when the caller is not an AGGREGATOR.
   */
  booking: aggregatorBookingInputSchema.optional(),
  /**
   * Aggregator-only: optional per-booking Invoice-To override.
   * Missing fields fall back to the aggregator's saved invoice profile.
   */
  invoiceTo: invoiceToOverrideSchema.optional(),
  /**
   * Aggregator-only: when true, the resolved Invoice-To is also saved as the
   * aggregator's default profile for future registrations.
   */
  saveInvoiceToProfile: z.boolean().optional(),
});

export class CreateClientProfileDto extends createZodDto(createClientProfileSchema) {}
