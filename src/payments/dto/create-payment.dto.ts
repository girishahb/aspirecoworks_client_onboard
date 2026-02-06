import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPaymentSchema = z.object({
  companyId: z.string().uuid('Invalid company ID format'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
});

export class CreatePaymentDto extends createZodDto(createPaymentSchema) {}
