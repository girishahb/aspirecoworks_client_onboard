import { z } from 'zod';

const blankToUndefined = z.union([z.string(), z.undefined()]).transform((value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
});

const optionalEmail = blankToUndefined.pipe(
  z.string().email('Enter a valid email address').max(200).optional(),
);

const optionalPhone = blankToUndefined.pipe(
  z
    .string()
    .min(5, 'Enter a valid phone number')
    .max(20)
    .regex(/^[0-9+\-().\s]+$/, 'Enter a valid phone number')
    .optional(),
);

export const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentBase64: z.string().min(1).max(8_000_000),
});

export const createTicketSchema = z.object({
  token: z.string().trim().min(16).max(200),
  customerName: z.string().trim().min(2, 'Name is required').max(200),
  companyName: z.string().trim().min(2, 'Company name is required').max(200),
  issueGroupId: z.string().uuid('Choose an issue group'),
  issueDescription: z.string().trim().min(5, 'Describe the issue').max(4000),
  customerEmail: optionalEmail,
  customerPhone: optionalPhone,
  attachment: attachmentSchema.optional(),
  clientRequestId: z.string().uuid().optional(),
  website: z.string().optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment').max(4000),
});

export const assignSchema = z.object({
  assigneeId: z.string().uuid(),
  reason: z.string().trim().min(3, 'Add a short reason').max(1000),
});

export const closeSchema = z.object({
  resolutionNotes: z.string().trim().min(3, 'Resolution notes are required').max(4000),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(3, 'A reason is required').max(1000),
});

export const saveRouteSchema = z.object({
  departmentId: z.string().uuid(),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  toEmails: z.array(z.string().trim().email().max(200)).max(10),
  ccEmails: z.array(z.string().trim().email().max(200)).max(10).optional().default([]),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
});

export const createQrSchema = z.object({
  locationId: z.string().uuid(),
  label: z.string().trim().min(2).max(80).optional(),
});

export const updateQrSchema = z.object({
  isActive: z.boolean(),
});

export const setHomeLocationSchema = z.object({
  locationId: z.string().uuid().nullable(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
