import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { AADHAAR_CONSENT_VERSION } from '../visitor.constants';

const imagePayloadSchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required'),
  mimeType: z
    .enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
    .optional()
    .default('image/jpeg'),
});

const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v),
  z.string().email().max(200).optional(),
);

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v),
    z.string().max(max).optional(),
  );

export const checkInVisitorSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    phone: z.string().trim().min(5, 'Phone is required').max(30),
    email: optionalEmail,
    company: optionalText(200),
    purpose: z.string().trim().min(1, 'Purpose is required').max(500),
    hostName: optionalText(200),
    hostEmail: optionalEmail,
    locationId: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().uuid().optional(),
    ),
    facePhoto: imagePayloadSchema,
    signature: imagePayloadSchema,
    aadhaarConsent: z.boolean().optional().default(false),
    aadhaarLast4: z
      .string()
      .regex(/^\d{4}$/, 'Aadhaar last 4 must be exactly 4 digits')
      .optional(),
    aadhaarPhoto: imagePayloadSchema.optional(),
    aadhaarConsentVersion: z.string().max(40).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.aadhaarConsent) {
      if (!data.aadhaarLast4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Aadhaar last 4 digits are required when consent is given',
          path: ['aadhaarLast4'],
        });
      }
      const version = data.aadhaarConsentVersion || AADHAAR_CONSENT_VERSION;
      if (version !== AADHAAR_CONSENT_VERSION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Consent text version is outdated; refresh the page and try again',
          path: ['aadhaarConsentVersion'],
        });
      }
    } else if (data.aadhaarLast4 || data.aadhaarPhoto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Aadhaar fields require explicit consent',
        path: ['aadhaarConsent'],
      });
    }
  });

export class CheckInVisitorDto extends createZodDto(checkInVisitorSchema) {}
