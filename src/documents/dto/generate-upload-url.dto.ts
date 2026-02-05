import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DocumentType } from '../../common/enums/document-type.enum';

// Allowed file types for KYC and agreements
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const;

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'] as const;

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Sanitize filename: remove path components and dangerous characters
function sanitizeFileName(fileName: string): string {
  // Remove path components
  const basename = fileName.split(/[/\\]/).pop() || fileName;
  // Remove dangerous characters, keep alphanumeric, dots, dashes, underscores
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Limit length
  return sanitized.slice(0, 255);
}

// Validate file extension
function validateFileExtension(fileName: string): boolean {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? ALLOWED_EXTENSIONS.includes(ext as any) : false;
}

export const generateUploadUrlSchema = z
  .object({
    fileName: z
      .string()
      .min(1, 'File name is required')
      .max(255, 'File name too long')
      .refine(
        (val) => {
          const sanitized = sanitizeFileName(val);
          return sanitized === val && validateFileExtension(val);
        },
        {
          message: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        },
      )
      .transform(sanitizeFileName),
    documentType: z.nativeEnum(DocumentType),
    fileSize: z
      .number()
      .int()
      .positive('File size must be positive')
      .max(MAX_FILE_SIZE, `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`),
    mimeType: z
      .string()
      .optional()
      .refine(
        (val) => !val || ALLOWED_MIME_TYPES.includes(val as any),
        {
          message: `Invalid MIME type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        },
      ),
    /** If provided, this upload replaces the given document (same company/type); keeps history via replacesId. */
    replacesDocumentId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      // Validate MIME type matches extension if both provided
      if (data.mimeType && data.fileName) {
        const ext = data.fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
        if (ext === '.pdf' && data.mimeType !== 'application/pdf') return false;
        if ((ext === '.jpg' || ext === '.jpeg') && !data.mimeType.startsWith('image/')) return false;
        if (ext === '.png' && data.mimeType !== 'image/png') return false;
      }
      return true;
    },
    {
      message: 'File extension does not match MIME type',
    },
  );

export class GenerateUploadUrlDto extends createZodDto(generateUploadUrlSchema) {}
