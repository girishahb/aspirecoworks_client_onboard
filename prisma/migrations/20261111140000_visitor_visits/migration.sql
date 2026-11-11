-- CreateEnum
CREATE TYPE "VisitorVisitStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT');

-- CreateTable
CREATE TABLE "visitor_visits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "purpose" TEXT NOT NULL,
    "hostName" TEXT,
    "hostEmail" TEXT,
    "locationId" TEXT,
    "status" "VisitorVisitStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "aadhaarConsent" BOOLEAN NOT NULL DEFAULT false,
    "aadhaarConsentAt" TIMESTAMP(3),
    "aadhaarConsentVersion" TEXT,
    "aadhaarLast4" VARCHAR(4),
    "facePhotoKey" TEXT NOT NULL,
    "signatureKey" TEXT NOT NULL,
    "aadhaarPhotoKey" TEXT,
    "checkedInById" TEXT,
    "checkedOutById" TEXT,
    "hostEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "hostEmailError" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visitor_visits_checkInAt_idx" ON "visitor_visits"("checkInAt");

-- CreateIndex
CREATE INDEX "visitor_visits_status_checkInAt_idx" ON "visitor_visits"("status", "checkInAt");

-- CreateIndex
CREATE INDEX "visitor_visits_locationId_idx" ON "visitor_visits"("locationId");

-- CreateIndex
CREATE INDEX "visitor_visits_phone_idx" ON "visitor_visits"("phone");

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_visits" ADD CONSTRAINT "visitor_visits_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
