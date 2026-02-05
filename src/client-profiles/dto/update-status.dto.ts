import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStage } from '../../common/enums/onboarding-stage.enum';

export const updateStatusSchema = z.object({
  stage: z.nativeEnum(OnboardingStage),
});

export class UpdateStatusDto extends createZodDto(updateStatusSchema) {}
