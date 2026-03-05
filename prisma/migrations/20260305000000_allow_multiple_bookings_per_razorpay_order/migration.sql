-- DropUniqueConstraint
-- Allow multiple bookings to share the same Razorpay order ID (multi-slot booking).
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_razorpayOrderId_key";
