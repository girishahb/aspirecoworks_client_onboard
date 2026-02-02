import { createZodDto } from 'nestjs-zod';
import { IsEmail } from 'class-validator';
import { z } from 'zod';

export const devLoginSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export class DevLoginDto extends createZodDto(devLoginSchema) {
  @IsEmail()
  email!: string;
}
