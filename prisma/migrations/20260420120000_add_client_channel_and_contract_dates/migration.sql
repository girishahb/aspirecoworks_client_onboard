-- CreateEnum
CREATE TYPE "ClientChannel" AS ENUM ('DIRECT', 'AGGREGATOR');

-- AlterTable
ALTER TABLE "client_profiles"
ADD COLUMN "clientChannel" "ClientChannel" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN "aggregatorName" TEXT,
ADD COLUMN "contractStartDate" TIMESTAMP(3),
ADD COLUMN "contractEndDate" TIMESTAMP(3);
