import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { OnboardingStage } from '../../common/enums/onboarding-stage.enum';

export const ClientChannelEnum = z.enum(['DIRECT', 'AGGREGATOR']);

export const createCompanySchema = z
  .object({
    companyName: z.string().min(1, 'Company name is required'),
    contactEmail: z.string().email('Invalid email format'),
    contactPhone: z.string().optional(),
    taxId: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
    onboardingStage: z.nativeEnum(OnboardingStage).default(OnboardingStage.ADMIN_CREATED),
    notes: z.string().optional(),
    clientChannel: ClientChannelEnum.default('DIRECT'),
    aggregatorName: z.string().optional(),
  })
  .refine(
    (data) =>
      data.clientChannel !== 'AGGREGATOR' ||
      (typeof data.aggregatorName === 'string' && data.aggregatorName.trim().length > 0),
    {
      message: 'aggregatorName is required when clientChannel is AGGREGATOR',
      path: ['aggregatorName'],
    },
  );

export class CreateCompanyDto extends createZodDto(createCompanySchema) {}
