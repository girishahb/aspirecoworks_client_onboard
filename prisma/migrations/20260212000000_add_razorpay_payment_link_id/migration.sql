-- AlterTable
ALTER TABLE "payments" ADD COLUMN "razorpayPaymentLinkId" TEXT;

-- CreateIndex
CREATE INDEX "payments_razorpayPaymentLinkId_idx" ON "payments"("razorpayPaymentLinkId");
