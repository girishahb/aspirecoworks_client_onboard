-- CreateEnum
CREATE TYPE "OperationalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'UNKNOWN');

-- AlterTable locations
ALTER TABLE "locations" ADD COLUMN "code" TEXT,
ADD COLUMN "area" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Backfill known seed location codes
UPDATE "locations" SET "code" = 'Indiranagar_1', "area" = 'Indiranagar' WHERE "id" = '00000000-0000-0000-0000-000000000001';
UPDATE "locations" SET "code" = 'Platinum', "area" = 'Indiranagar' WHERE "id" = '00000000-0000-0000-0000-000000000002';
UPDATE "locations" SET "code" = 'Kormangala_1', "area" = 'Kormangala' WHERE "id" = '00000000-0000-0000-0000-000000000003';

CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateTable vendors
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "locationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendors_locationId_idx" ON "vendors"("locationId");
CREATE UNIQUE INDEX "vendors_locationId_code_key" ON "vendors"("locationId", "code");

ALTER TABLE "vendors" ADD CONSTRAINT "vendors_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable client_profiles
ALTER TABLE "client_profiles" ADD COLUMN "locationId" TEXT,
ADD COLUMN "vendorId" TEXT,
ADD COLUMN "membershipType" TEXT,
ADD COLUMN "operationalStatus" "OperationalStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "contactPersonName" TEXT,
ADD COLUMN "contactPersonTitle" TEXT,
ADD COLUMN "contactPersonPhone" TEXT,
ADD COLUMN "externalBookingId" TEXT,
ADD COLUMN "legacyPaymentStatus" TEXT,
ADD COLUMN "legacyCharges" DOUBLE PRECISION,
ADD COLUMN "lastContactedAt" DATE;

CREATE INDEX "client_profiles_locationId_idx" ON "client_profiles"("locationId");
CREATE INDEX "client_profiles_vendorId_idx" ON "client_profiles"("vendorId");
CREATE INDEX "client_profiles_externalBookingId_idx" ON "client_profiles"("externalBookingId");
CREATE INDEX "client_profiles_operationalStatus_idx" ON "client_profiles"("operationalStatus");

ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
