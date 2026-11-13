-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketEventType" AS ENUM ('CREATED', 'ASSIGNED', 'COMMENTED', 'STATUS_CHANGED', 'EMAIL', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "RecipientKind" AS ENUM ('TO', 'CC');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "homeLocationId" TEXT;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_group_routes" (
    "id" TEXT NOT NULL,
    "issueGroupId" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "locationId" TEXT,
    "departmentId" TEXT NOT NULL,
    "defaultAssigneeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_group_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_group_recipients" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "RecipientKind" NOT NULL DEFAULT 'TO',

    CONSTRAINT "issue_group_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_codes" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sequences" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ticket_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "customerName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "locationId" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "issueGroupId" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "assignedDepartmentId" TEXT,
    "assignedUserId" TEXT,
    "resolutionNotes" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "TicketEventType" NOT NULL,
    "actorId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "toEmails" TEXT[],
    "ccEmails" TEXT[],
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "issue_group_routes_issueGroupId_locationKey_key" ON "issue_group_routes"("issueGroupId", "locationKey");

-- CreateIndex
CREATE INDEX "issue_group_routes_locationId_idx" ON "issue_group_routes"("locationId");

-- CreateIndex
CREATE INDEX "issue_group_recipients_routeId_idx" ON "issue_group_recipients"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_publicToken_key" ON "qr_codes"("publicToken");

-- CreateIndex
CREATE INDEX "qr_codes_locationId_idx" ON "qr_codes"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticketNumber_key" ON "tickets"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_clientRequestId_key" ON "tickets"("clientRequestId");

-- CreateIndex
CREATE INDEX "tickets_status_createdAt_idx" ON "tickets"("status", "createdAt");

-- CreateIndex
CREATE INDEX "tickets_locationId_status_idx" ON "tickets"("locationId", "status");

-- CreateIndex
CREATE INDEX "tickets_issueGroupId_idx" ON "tickets"("issueGroupId");

-- CreateIndex
CREATE INDEX "tickets_assignedDepartmentId_idx" ON "tickets"("assignedDepartmentId");

-- CreateIndex
CREATE INDEX "tickets_assignedUserId_status_idx" ON "tickets"("assignedUserId", "status");

-- CreateIndex
CREATE INDEX "tickets_companyName_idx" ON "tickets"("companyName");

-- CreateIndex
CREATE INDEX "tickets_createdAt_idx" ON "tickets"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_events_ticketId_createdAt_idx" ON "ticket_events"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_attachments_ticketId_idx" ON "ticket_attachments"("ticketId");

-- CreateIndex
CREATE INDEX "notification_logs_status_attempt_idx" ON "notification_logs"("status", "attempt");

-- CreateIndex
CREATE INDEX "notification_logs_ticketId_idx" ON "notification_logs"("ticketId");

-- CreateIndex
CREATE INDEX "users_homeLocationId_idx" ON "users"("homeLocationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_homeLocationId_fkey" FOREIGN KEY ("homeLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_group_routes" ADD CONSTRAINT "issue_group_routes_issueGroupId_fkey" FOREIGN KEY ("issueGroupId") REFERENCES "issue_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_group_routes" ADD CONSTRAINT "issue_group_routes_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_group_routes" ADD CONSTRAINT "issue_group_routes_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_group_routes" ADD CONSTRAINT "issue_group_routes_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_group_recipients" ADD CONSTRAINT "issue_group_recipients_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "issue_group_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "qr_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_issueGroupId_fkey" FOREIGN KEY ("issueGroupId") REFERENCES "issue_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedDepartmentId_fkey" FOREIGN KEY ("assignedDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
