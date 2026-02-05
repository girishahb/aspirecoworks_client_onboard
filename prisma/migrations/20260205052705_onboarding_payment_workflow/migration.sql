-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentOwner" AS ENUM ('CLIENT', 'ADMIN');

-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'APPROVED';

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'KYC';

-- AlterEnum
ALTER TYPE "OnboardingStage" ADD VALUE 'PAYMENT_PENDING';

-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN     "kycCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "documentOwner" "DocumentOwner" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN     "reviewNotes" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "paymentLink" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_clientProfileId_idx" ON "payments"("clientProfileId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
