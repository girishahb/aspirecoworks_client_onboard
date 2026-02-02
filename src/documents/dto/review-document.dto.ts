import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DocumentStatus } from '../../common/enums/document-status.enum';

export const reviewDocumentSchema = z.object({
  status: z.nativeEnum(DocumentStatus),
  rejectionReason: z.string().optional(),
}).refine(
  (data) => {
    if (data.status === DocumentStatus.REJECTED && !data.rejectionReason) {
      return false;
    }
    return true;
  },
  {
    message: 'Rejection reason is required when rejecting a document',
    path: ['rejectionReason'],
  },
);

export class ReviewDocumentDto extends createZodDto(reviewDocumentSchema) {}
