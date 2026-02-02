import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateCompanySchema = z.object({
  companyName: z.string().min(1, 'Company name is required').optional(),
  contactEmail: z.string().email('Invalid email format').optional(),
  contactPhone: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

export class UpdateCompanyDto extends createZodDto(updateCompanySchema) {}

