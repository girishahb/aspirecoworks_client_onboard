import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createAggregatorUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  aggregatorName: z.string().min(1, 'Aggregator name is required'),
});

export class CreateAggregatorUserDto extends createZodDto(createAggregatorUserSchema) {}
