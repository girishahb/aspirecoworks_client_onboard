-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AGGREGATOR';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "aggregatorName" TEXT;
