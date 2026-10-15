-- Enforce unique External Booking ID across client profiles (NULLs allowed).
-- Clear blank values and keep the earliest row when duplicates already exist.

UPDATE "client_profiles"
SET "externalBookingId" = NULL
WHERE "externalBookingId" IS NOT NULL AND TRIM("externalBookingId") = '';

UPDATE "client_profiles" AS cp
SET "externalBookingId" = NULL
FROM (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "externalBookingId"
        ORDER BY "createdAt" ASC, id ASC
      ) AS rn
    FROM "client_profiles"
    WHERE "externalBookingId" IS NOT NULL
  ) ranked
  WHERE ranked.rn > 1
) dups
WHERE cp.id = dups.id;

DROP INDEX IF EXISTS "client_profiles_externalBookingId_idx";

CREATE UNIQUE INDEX "client_profiles_externalBookingId_key" ON "client_profiles"("externalBookingId");
