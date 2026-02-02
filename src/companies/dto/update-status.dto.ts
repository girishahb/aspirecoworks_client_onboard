import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStatus } from '../../common/enums/onboarding-status.enum';

export const updateCompanyStatusSchema = z.object({
  status: z.nativeEnum(OnboardingStatus),
});

export class UpdateCompanyStatusDto extends createZodDto(updateCompanyStatusSchema) {}

