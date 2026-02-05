-- Add new OnboardingStage values for KYC review workflow
ALTER TYPE "OnboardingStage" ADD VALUE IF NOT EXISTS 'KYC_REVIEW';
ALTER TYPE "OnboardingStage" ADD VALUE IF NOT EXISTS 'AGREEMENT_DRAFT_SHARED';

-- Add new DocumentStatus for "Pending with Client"
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING_WITH_CLIENT';

-- Store admin remarks on documents (approve/reject/pending with client)
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "adminRemarks" TEXT;
