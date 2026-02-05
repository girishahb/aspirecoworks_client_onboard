import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const adminAgreementDraftUploadSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().int().positive('File size must be positive'),
  mimeType: z.string().optional(),
});

export class AdminAgreementDraftUploadDto extends createZodDto(adminAgreementDraftUploadSchema) {}
