import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
