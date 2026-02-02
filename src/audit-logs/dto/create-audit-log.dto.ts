import { z } from 'zod';

export const createAuditLogSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  clientProfileId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  action: z.string().min(1, 'Action is required'),
  entityType: z.string().min(1, 'Entity type is required'),
  entityId: z.string().min(1, 'Entity ID is required'),
  changes: z.any().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
});

export type CreateAuditLogDto = z.infer<typeof createAuditLogSchema>;
