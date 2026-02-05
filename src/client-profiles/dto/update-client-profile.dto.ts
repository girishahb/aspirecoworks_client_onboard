import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStage } from '../../common/enums/onboarding-stage.enum';

export const updateClientProfileSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').optional(),
  contactEmail: z.string().email('Invalid email format').optional(),
  contactPhone: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  onboardingStage: z.nativeEnum(OnboardingStage).optional(),
  notes: z.string().optional(),
});

export class UpdateClientProfileDto extends createZodDto(updateClientProfileSchema) {}
