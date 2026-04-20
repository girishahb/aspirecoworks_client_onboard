-- CreateTable: AggregatorInvoiceProfile (1:1 with AGGREGATOR users)
CREATE TABLE "aggregator_invoice_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "constitution" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "registeredAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregator_invoice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aggregator_invoice_profiles_userId_key" ON "aggregator_invoice_profiles"("userId");

-- AddForeignKey
ALTER TABLE "aggregator_invoice_profiles"
  ADD CONSTRAINT "aggregator_invoice_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: AggregatorBooking (many per ClientProfile)
CREATE TABLE "aggregator_bookings" (
    "id" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "bookingReference" TEXT,
    "planType" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "durationMonths" INTEGER,
    "amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "paymentTerms" TEXT,
    "signageTerms" TEXT,
    "clientContactName" TEXT,
    "pocName" TEXT,
    "pocContact" TEXT,
    "invoiceLegalName" TEXT,
    "invoiceConstitution" TEXT,
    "invoiceGstin" TEXT,
    "invoicePan" TEXT,
    "invoiceRegisteredAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregator_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aggregator_bookings_clientProfileId_idx" ON "aggregator_bookings"("clientProfileId");
CREATE INDEX "aggregator_bookings_createdById_idx" ON "aggregator_bookings"("createdById");
CREATE INDEX "aggregator_bookings_bookingReference_idx" ON "aggregator_bookings"("bookingReference");

-- AddForeignKey
ALTER TABLE "aggregator_bookings"
  ADD CONSTRAINT "aggregator_bookings_clientProfileId_fkey"
  FOREIGN KEY ("clientProfileId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "aggregator_bookings"
  ADD CONSTRAINT "aggregator_bookings_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
