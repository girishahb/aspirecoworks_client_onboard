-- Add REVIEW_PENDING for KYC uploads (awaiting admin review)
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'REVIEW_PENDING';
