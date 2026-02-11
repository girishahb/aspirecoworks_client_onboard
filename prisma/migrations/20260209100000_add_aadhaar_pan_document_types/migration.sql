-- Add AADHAAR and PAN to DocumentType for KYC documents
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'AADHAAR';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PAN';
