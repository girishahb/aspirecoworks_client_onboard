import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DocumentType } from '../../common/enums/document-type.enum';

export const createComplianceRequirementSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  name: z.string().optional(),
  description: z.string().optional(),
});

export class CreateComplianceRequirementDto extends createZodDto(
  createComplianceRequirementSchema,
) {}
