-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('PUBLIC', 'INTERNAL_COUPON');

-- AlterTable
ALTER TABLE "bookings"
ADD COLUMN "bookingSource" "BookingSource" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "couponCodeUsed" TEXT;
