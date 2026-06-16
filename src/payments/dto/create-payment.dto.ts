import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const gstModeSchema = z.enum(['NONE', 'CGST_SGST', 'IGST']);

export const createPaymentSchema = z
  .object({
    companyId: z.string().uuid('Invalid company ID format'),
    amount: z.number().positive('Amount must be positive').optional(),
    currency: z.string().default('INR'),
    gstMode: gstModeSchema.default('NONE'),
    taxableAmount: z.number().positive('Taxable amount must be positive').optional(),
    cgstRate: z.number().min(0).max(100).optional(),
    sgstRate: z.number().min(0).max(100).optional(),
    igstRate: z.number().min(0).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.gstMode === 'NONE') {
      if (data.amount == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Amount is required when GST is not included',
          path: ['amount'],
        });
      }
      return;
    }

    if (data.taxableAmount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Taxable amount is required when GST is included',
        path: ['taxableAmount'],
      });
    }

    if (data.gstMode === 'CGST_SGST') {
      if (data.cgstRate == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CGST rate is required',
          path: ['cgstRate'],
        });
      }
      if (data.sgstRate == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SGST rate is required',
          path: ['sgstRate'],
        });
      }
    }

    if (data.gstMode === 'IGST' && data.igstRate == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'IGST rate is required',
        path: ['igstRate'],
      });
    }
  });

export class CreatePaymentDto extends createZodDto(createPaymentSchema) {}
