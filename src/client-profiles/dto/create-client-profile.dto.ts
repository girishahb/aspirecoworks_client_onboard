import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStage } from '../../common/enums/onboarding-stage.enum';

// Helper to transform empty strings to undefined for optional fields
const optionalString = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.string().optional()
);

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
});

export class CreateClientProfileDto extends createZodDto(createClientProfileSchema) {}
