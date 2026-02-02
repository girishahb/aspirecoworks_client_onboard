import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const requestLoginSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export class RequestLoginDto extends createZodDto(requestLoginSchema) {}
