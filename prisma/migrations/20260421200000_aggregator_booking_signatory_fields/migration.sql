-- Add signatory details to aggregator_bookings for rendering the Leave & License agreement draft
ALTER TABLE "aggregator_bookings" ADD COLUMN "clientFatherOrSpouseName" TEXT;
ALTER TABLE "aggregator_bookings" ADD COLUMN "clientPan" TEXT;
ALTER TABLE "aggregator_bookings" ADD COLUMN "clientAadhaar" TEXT;
