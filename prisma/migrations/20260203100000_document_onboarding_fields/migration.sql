-- AlterTable: add new columns for onboarding workflow (nullable first for safe backfill)
ALTER TABLE "documents" ADD COLUMN "ownerId" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "replacesId" TEXT;

-- Backfill ownerId from uploadedById (owner = uploader for existing documents)
UPDATE "documents" SET "ownerId" = "uploadedById" WHERE "ownerId" IS NULL;

-- CreateIndex for document list by company + type (unlimited uploads per type, no unique constraint)
CREATE INDEX "documents_clientProfileId_documentType_idx" ON "documents"("clientProfileId", "documentType");

-- AddForeignKey for ownerId
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for replacesId (self-reference for history)
ALTER TABLE "documents" ADD CONSTRAINT "documents_replacesId_fkey" 
  FOREIGN KEY ("replacesId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for history lookups
CREATE INDEX "documents_replacesId_idx" ON "documents"("replacesId");
CREATE INDEX "documents_ownerId_idx" ON "documents"("ownerId");
