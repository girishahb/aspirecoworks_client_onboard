/*
  Warnings:

  - You are about to drop the column `filePath` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `documents` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fileKey]` on the table `documents` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `documentType` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'LICENSE', 'CERTIFICATE', 'IDENTIFICATION', 'FINANCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN     "renewalDate" TIMESTAMP(3),
ADD COLUMN     "renewalStatus" "RenewalStatus";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "filePath",
DROP COLUMN "fileType",
ADD COLUMN     "documentType" "DocumentType" NOT NULL,
ADD COLUMN     "fileKey" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT;

-- CreateTable
CREATE TABLE "renewal_reminders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renewal_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_requirements" (
    "id" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "renewal_reminders_companyId_idx" ON "renewal_reminders"("companyId");

-- CreateIndex
CREATE INDEX "renewal_reminders_sentAt_idx" ON "renewal_reminders"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_reminders_companyId_daysBefore_key" ON "renewal_reminders"("companyId", "daysBefore");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_requirements_documentType_key" ON "compliance_requirements"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "documents_fileKey_key" ON "documents"("fileKey");

-- CreateIndex
CREATE INDEX "documents_clientProfileId_idx" ON "documents"("clientProfileId");

-- CreateIndex
CREATE INDEX "documents_uploadedById_idx" ON "documents"("uploadedById");

-- CreateIndex
CREATE INDEX "documents_fileKey_idx" ON "documents"("fileKey");

-- CreateIndex
CREATE INDEX "documents_documentType_idx" ON "documents"("documentType");

-- AddForeignKey
ALTER TABLE "renewal_reminders" ADD CONSTRAINT "renewal_reminders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
