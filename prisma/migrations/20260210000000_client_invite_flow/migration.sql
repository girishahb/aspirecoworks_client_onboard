-- AlterTable: Add invite flow fields to users, make passwordHash nullable
ALTER TABLE "users" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "users" ADD COLUMN "inviteTokenExpiry" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "isActivated" BOOLEAN NOT NULL DEFAULT false;

-- Make passwordHash nullable
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Set isActivated = true for existing users who have a password (they can already login)
UPDATE "users" SET "isActivated" = true WHERE "passwordHash" IS NOT NULL;

-- Unique constraint for inviteToken
CREATE UNIQUE INDEX "users_inviteToken_key" ON "users"("inviteToken");
