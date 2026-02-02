import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DocumentType } from '../../common/enums/document-type.enum';

export const generateUploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  documentType: z.nativeEnum(DocumentType),
  fileSize: z.number().int().positive('File size must be positive'),
  mimeType: z.string().optional(),
});

export class GenerateUploadUrlDto extends createZodDto(generateUploadUrlSchema) {}
