import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const adminFinalDocTypes = [
  'AGREEMENT_FINAL',
  'NOC_ASPIRE_COWORKS',
  'NOC_LANDLORD',
  'ELECTRICITY_BILL',
  'WIFI_BILL',
] as const;

export const adminAgreementFinalUploadSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().int().positive('File size must be positive'),
  mimeType: z.string().optional(),
  documentType: z.enum(adminFinalDocTypes).optional().default('AGREEMENT_FINAL'),
});

export class AdminAgreementFinalUploadDto extends createZodDto(adminAgreementFinalUploadSchema) {}
