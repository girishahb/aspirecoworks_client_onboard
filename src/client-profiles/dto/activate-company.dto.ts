import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Optional contract dates used when activating a company. Required for AGGREGATOR
 * channel, optional for DIRECT. Validation of AGGREGATOR-vs-DIRECT is done in the
 * service layer where the company record is loaded.
 */
export const activateCompanySchema = z
  .object({
    contractStartDate: z.coerce.date().optional(),
    contractEndDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (!data.contractStartDate || !data.contractEndDate) return true;
      return data.contractEndDate.getTime() > data.contractStartDate.getTime();
    },
    {
      message: 'contractEndDate must be after contractStartDate',
      path: ['contractEndDate'],
    },
  );

export class ActivateCompanyDto extends createZodDto(activateCompanySchema) {}
