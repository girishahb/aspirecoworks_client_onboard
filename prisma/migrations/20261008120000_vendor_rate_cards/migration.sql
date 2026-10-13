-- CreateTable
CREATE TABLE "vendor_rate_cards" (
    "id" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "sourceCompanyName" TEXT,
    "membershipType" TEXT NOT NULL,
    "rateExclusive" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_rate_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_rate_cards_vendorCode_membershipType_key" ON "vendor_rate_cards"("vendorCode", "membershipType");
CREATE INDEX "vendor_rate_cards_vendorCode_idx" ON "vendor_rate_cards"("vendorCode");
