-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bookings_status_expiresAt_idx" ON "bookings"("status", "expiresAt");
