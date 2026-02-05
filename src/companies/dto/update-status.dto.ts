import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStage } from '../../common/enums/onboarding-stage.enum';

export const updateCompanyStatusSchema = z.object({
  stage: z.nativeEnum(OnboardingStage),
});

export class UpdateCompanyStatusDto extends createZodDto(updateCompanyStatusSchema) {}
