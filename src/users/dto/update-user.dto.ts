import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserRole } from '../../common/enums/user-role.enum';

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
