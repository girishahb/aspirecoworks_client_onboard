-- Add new onboarding stages for payment and KYC gating
ALTER TYPE "OnboardingStage" ADD VALUE IF NOT EXISTS 'PAYMENT_CONFIRMED';
ALTER TYPE "OnboardingStage" ADD VALUE IF NOT EXISTS 'KYC_IN_PROGRESS';
