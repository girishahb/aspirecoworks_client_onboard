import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DocumentStatus } from '../../common/enums/document-status.enum';

export const reviewDocumentSchema = z
  .object({
    status: z.nativeEnum(DocumentStatus),
    rejectionReason: z.string().max(2000).optional(),
    adminRemarks: z.string().max(2000).optional(),
  })
  .refine(
    (data) =>
      data.status === DocumentStatus.VERIFIED ||
      data.status === DocumentStatus.REJECTED ||
      data.status === DocumentStatus.PENDING_WITH_CLIENT,
    { message: 'status must be VERIFIED, REJECTED, or PENDING_WITH_CLIENT', path: ['status'] },
  )
  .refine(
    (data) => {
      if (data.status === DocumentStatus.REJECTED && !data.rejectionReason?.trim()) return false;
      return true;
    },
    { message: 'Rejection reason is required when rejecting a document', path: ['rejectionReason'] },
  );

export class ReviewDocumentDto extends createZodDto(reviewDocumentSchema) {}
