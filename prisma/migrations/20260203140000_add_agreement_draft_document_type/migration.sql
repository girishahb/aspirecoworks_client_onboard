-- Add AGREEMENT_DRAFT to DocumentType for admin-uploaded agreement drafts
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'AGREEMENT_DRAFT';
