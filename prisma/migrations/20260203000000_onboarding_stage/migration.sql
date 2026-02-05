-- CreateEnum
CREATE TYPE "OnboardingStage" AS ENUM ('ADMIN_CREATED', 'PENDING_DOCUMENTS', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED');

-- AlterTable: add new column with default
ALTER TABLE "client_profiles" ADD COLUMN "onboardingStage" "OnboardingStage" NOT NULL DEFAULT 'ADMIN_CREATED';

-- Backfill from old onboardingStatus
UPDATE "client_profiles"
SET "onboardingStage" = CASE "onboardingStatus"
  WHEN 'PENDING' THEN 'ADMIN_CREATED'::"OnboardingStage"
  WHEN 'IN_PROGRESS' THEN 'PENDING_DOCUMENTS'::"OnboardingStage"
  WHEN 'COMPLETED' THEN 'COMPLETED'::"OnboardingStage"
  WHEN 'REJECTED' THEN 'REJECTED'::"OnboardingStage"
  ELSE 'ADMIN_CREATED'::"OnboardingStage"
END;

-- Drop old column and enum
ALTER TABLE "client_profiles" DROP COLUMN "onboardingStatus";
DROP TYPE "OnboardingStatus";
