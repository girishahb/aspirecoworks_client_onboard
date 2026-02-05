import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Optional review notes (approve, pending-admin). */
export const kycReviewNotesOptionalSchema = z.object({
  reviewNotes: z.string().max(5000).optional().nullable(),
});

/** Required review notes (reject, pending-client). */
export const kycReviewNotesRequiredSchema = z.object({
  reviewNotes: z.string().min(1, 'Review notes are required for this action').max(5000),
});

export class KycApproveDto extends createZodDto(kycReviewNotesOptionalSchema) {}
export class KycRejectDto extends createZodDto(kycReviewNotesRequiredSchema) {}
export class KycPendingClientDto extends createZodDto(kycReviewNotesRequiredSchema) {}
export class KycPendingAdminDto extends createZodDto(kycReviewNotesOptionalSchema) {}
