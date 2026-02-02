import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStatus } from '../../common/enums/onboarding-status.enum';

export const createCompanySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactEmail: z.string().email('Invalid email format'),
  contactPhone: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  onboardingStatus: z.nativeEnum(OnboardingStatus).default(OnboardingStatus.PENDING),
  notes: z.string().optional(),
});

export class CreateCompanyDto extends createZodDto(createCompanySchema) {}

