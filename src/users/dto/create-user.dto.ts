import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserRole } from '../../common/enums/user-role.enum';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  passwordHash: z.string().min(1, 'Password hash is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  isActive: z.boolean().default(true),
});

export class CreateUserDto extends createZodDto(createUserSchema) {}
