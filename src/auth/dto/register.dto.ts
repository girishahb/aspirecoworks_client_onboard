import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { UserRole } from '../../common/enums/user-role.enum';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});

export class RegisterDto extends createZodDto(registerSchema) {}
