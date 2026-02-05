import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsDto {
  @ApiProperty({ description: 'Total number of companies' })
  totalCompanies!: number;

  @ApiProperty({ description: 'Number of active companies (onboardingStage = ACTIVE)' })
  activeCompanies!: number;

  @ApiProperty({ description: 'Number of companies with payment pending' })
  paymentPending!: number;

  @ApiProperty({ description: 'Number of companies in KYC stages (KYC_IN_PROGRESS, KYC_REVIEW)' })
  kycPending!: number;

  @ApiProperty({ description: 'Number of companies in agreement stages (AGREEMENT_DRAFT_SHARED, SIGNED_AGREEMENT_RECEIVED)' })
  agreementsPending!: number;

  @ApiProperty({ description: 'Number of companies ready for activation (FINAL_AGREEMENT_SHARED)' })
  readyForActivation!: number;

  @ApiProperty({ description: 'Total revenue from all paid payments' })
  totalRevenue!: number;

  @ApiProperty({ description: 'Revenue collected this month' })
  revenueThisMonth!: number;

  @ApiProperty({
    description: 'Count of companies per onboarding stage',
    example: {
      ADMIN_CREATED: 5,
      PAYMENT_PENDING: 3,
      PAYMENT_CONFIRMED: 2,
      KYC_IN_PROGRESS: 4,
      KYC_REVIEW: 1,
      AGREEMENT_DRAFT_SHARED: 2,
      SIGNED_AGREEMENT_RECEIVED: 1,
      FINAL_AGREEMENT_SHARED: 1,
      ACTIVE: 10,
    },
  })
  stageCounts!: Record<string, number>;
}
