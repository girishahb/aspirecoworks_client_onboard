-- Historical agreement terms when start/end or booking ID changes
CREATE TABLE "client_contract_history" (
    "id" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "externalBookingId" TEXT,
    "note" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contract_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_contract_history_clientProfileId_changedAt_idx" ON "client_contract_history"("clientProfileId", "changedAt");

CREATE INDEX "client_contract_history_changedById_idx" ON "client_contract_history"("changedById");

ALTER TABLE "client_contract_history" ADD CONSTRAINT "client_contract_history_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_contract_history" ADD CONSTRAINT "client_contract_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
