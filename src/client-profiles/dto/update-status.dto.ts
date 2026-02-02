import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStatus } from '../../common/enums/onboarding-status.enum';

export const updateStatusSchema = z.object({
  status: z.nativeEnum(OnboardingStatus),
});

export class UpdateStatusDto extends createZodDto(updateStatusSchema) {}
