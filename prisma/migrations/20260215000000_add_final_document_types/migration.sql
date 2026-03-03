-- Add post-agreement document types for admin upload / client download
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'NOC_ASPIRE_COWORKS';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'NOC_LANDLORD';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'ELECTRICITY_BILL';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'WIFI_BILL';
