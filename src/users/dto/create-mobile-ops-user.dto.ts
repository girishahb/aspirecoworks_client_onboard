import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MOBILE_OPS_ROLES = ['RECEPTION', 'STAFF', 'FINANCE'] as const;

export const createMobileOpsUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(MOBILE_OPS_ROLES),
  isActive: z.boolean().default(true).optional(),
});

export class CreateMobileOpsUserDto extends createZodDto(createMobileOpsUserSchema) {}
