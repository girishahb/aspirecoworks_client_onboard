import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateCompanyRenewalSchema = z.object({
  notes: z.string().optional(),
});

export class UpdateCompanyRenewalDto extends createZodDto(updateCompanyRenewalSchema) {}

