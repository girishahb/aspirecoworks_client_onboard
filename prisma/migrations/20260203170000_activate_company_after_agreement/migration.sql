-- Activate company after agreement: ACTIVE stage and activationDate
ALTER TYPE "OnboardingStage" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "activationDate" TIMESTAMP(3);
