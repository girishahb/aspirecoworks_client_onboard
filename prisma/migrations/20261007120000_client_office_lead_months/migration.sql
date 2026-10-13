-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "officeType" TEXT;
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "leadSource" TEXT;
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "contractMonths" INTEGER;
