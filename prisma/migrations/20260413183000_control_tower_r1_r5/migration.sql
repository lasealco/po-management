-- Control Tower (R1–R5): references, flexible milestones, docs, notes, financials, alerts, exceptions, audit, saved filters.
-- Extend transport modes for courier / parcel flows.

CREATE TYPE "CtDocVisibility" AS ENUM ('INTERNAL', 'CUSTOMER_SHAREABLE');
CREATE TYPE "CtNoteVisibility" AS ENUM ('INTERNAL', 'SHARED');
CREATE TYPE "CtAlertSeverity" AS ENUM ('INFO', 'WARN', 'CRITICAL');
CREATE TYPE "CtAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');
CREATE TYPE "CtExceptionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "CtShipmentReference" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CtShipmentReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtShipmentReference_shipmentId_idx" ON "CtShipmentReference"("shipmentId");
CREATE INDEX "CtShipmentReference_refValue_idx" ON "CtShipmentReference"("refValue");
ALTER TABLE "CtShipmentReference" ADD CONSTRAINT "CtShipmentReference_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CtTrackingMilestone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "plannedAt" TIMESTAMP(3),
    "predictedAt" TIMESTAMP(3),
    "actualAt" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceRef" TEXT,
    "confidence" INTEGER,
    "notes" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CtTrackingMilestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtTrackingMilestone_tenantId_shipmentId_idx" ON "CtTrackingMilestone"("tenantId", "shipmentId");
CREATE INDEX "CtTrackingMilestone_code_idx" ON "CtTrackingMilestone"("code");
ALTER TABLE "CtTrackingMilestone" ADD CONSTRAINT "CtTrackingMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtTrackingMilestone" ADD CONSTRAINT "CtTrackingMilestone_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtTrackingMilestone" ADD CONSTRAINT "CtTrackingMilestone_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CtShipmentDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "visibility" "CtDocVisibility" NOT NULL DEFAULT 'INTERNAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CtShipmentDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtShipmentDocument_shipmentId_idx" ON "CtShipmentDocument"("shipmentId");
ALTER TABLE "CtShipmentDocument" ADD CONSTRAINT "CtShipmentDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentDocument" ADD CONSTRAINT "CtShipmentDocument_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentDocument" ADD CONSTRAINT "CtShipmentDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CtShipmentNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "CtNoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CtShipmentNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtShipmentNote_shipmentId_idx" ON "CtShipmentNote"("shipmentId");
ALTER TABLE "CtShipmentNote" ADD CONSTRAINT "CtShipmentNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentNote" ADD CONSTRAINT "CtShipmentNote_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentNote" ADD CONSTRAINT "CtShipmentNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CtShipmentFinancialSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "customerVisibleCost" DECIMAL(14,2),
    "internalCost" DECIMAL(14,2),
    "internalRevenue" DECIMAL(14,2),
    "internalNet" DECIMAL(14,2),
    "internalMarginPct" DECIMAL(9,4),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "CtShipmentFinancialSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtShipmentFinancialSnapshot_shipmentId_asOf_idx" ON "CtShipmentFinancialSnapshot"("shipmentId", "asOf");
ALTER TABLE "CtShipmentFinancialSnapshot" ADD CONSTRAINT "CtShipmentFinancialSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentFinancialSnapshot" ADD CONSTRAINT "CtShipmentFinancialSnapshot_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentFinancialSnapshot" ADD CONSTRAINT "CtShipmentFinancialSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CtAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "CtAlertSeverity" NOT NULL DEFAULT 'WARN',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "ownerUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "status" "CtAlertStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CtAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtAlert_tenantId_status_idx" ON "CtAlert"("tenantId", "status");
CREATE INDEX "CtAlert_shipmentId_idx" ON "CtAlert"("shipmentId");
ALTER TABLE "CtAlert" ADD CONSTRAINT "CtAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtAlert" ADD CONSTRAINT "CtAlert_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtAlert" ADD CONSTRAINT "CtAlert_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CtAlert" ADD CONSTRAINT "CtAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CtException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "CtAlertSeverity" NOT NULL DEFAULT 'WARN',
    "ownerUserId" TEXT,
    "rootCause" TEXT,
    "status" "CtExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "claimAmount" DECIMAL(14,2),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CtException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtException_shipmentId_idx" ON "CtException"("shipmentId");
CREATE INDEX "CtException_tenantId_status_idx" ON "CtException"("tenantId", "status");
ALTER TABLE "CtException" ADD CONSTRAINT "CtException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtException" ADD CONSTRAINT "CtException_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtException" ADD CONSTRAINT "CtException_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CtAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CtAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtAuditLog_tenantId_shipmentId_idx" ON "CtAuditLog"("tenantId", "shipmentId");
CREATE INDEX "CtAuditLog_entityType_entityId_idx" ON "CtAuditLog"("entityType", "entityId");
ALTER TABLE "CtAuditLog" ADD CONSTRAINT "CtAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtAuditLog" ADD CONSTRAINT "CtAuditLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CtAuditLog" ADD CONSTRAINT "CtAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CtSavedFilter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CtSavedFilter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtSavedFilter_userId_idx" ON "CtSavedFilter"("userId");
ALTER TABLE "CtSavedFilter" ADD CONSTRAINT "CtSavedFilter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtSavedFilter" ADD CONSTRAINT "CtSavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
