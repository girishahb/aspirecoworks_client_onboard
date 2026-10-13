import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const mailNotifySchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required'),
  mimeType: z
    .enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
    .optional()
    .default('image/jpeg'),
  fileName: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
});

export class MailNotifyDto extends createZodDto(mailNotifySchema) {}
