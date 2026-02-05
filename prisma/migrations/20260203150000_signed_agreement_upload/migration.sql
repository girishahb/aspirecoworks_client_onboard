-- Signed agreement upload: new stage and document type
ALTER TYPE "OnboardingStage" ADD VALUE IF NOT EXISTS 'SIGNED_AGREEMENT_RECEIVED';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'AGREEMENT_SIGNED';
