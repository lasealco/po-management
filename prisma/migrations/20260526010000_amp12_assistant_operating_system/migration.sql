-- AMP12: customer-ready assistant operating reports generated from live telemetry.
CREATE TABLE "AssistantOperatingReport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "reportKey" VARCHAR(128) NOT NULL,
  "title" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "score" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT NOT NULL,
  "reportJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantOperatingReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantOperatingReport_tenantId_reportKey_createdAt_idx"
  ON "AssistantOperatingReport"("tenantId", "reportKey", "createdAt");
CREATE INDEX "AssistantOperatingReport_tenantId_status_createdAt_idx"
  ON "AssistantOperatingReport"("tenantId", "status", "createdAt");

ALTER TABLE "AssistantOperatingReport"
  ADD CONSTRAINT "AssistantOperatingReport_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantOperatingReport_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
