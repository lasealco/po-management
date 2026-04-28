-- AMP11: assistant admin rollout controls and compliance packet snapshots.
CREATE TABLE "AssistantAdminControl" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "controlKey" VARCHAR(128) NOT NULL,
  "rolloutMode" VARCHAR(32) NOT NULL DEFAULT 'PILOT',
  "pilotRolesJson" JSONB NOT NULL DEFAULT '[]',
  "pilotSitesJson" JSONB NOT NULL DEFAULT '[]',
  "thresholdsJson" JSONB NOT NULL,
  "flagsJson" JSONB NOT NULL,
  "packetJson" JSONB,
  "packetStatus" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantAdminControl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssistantAdminControl_tenantId_controlKey_key"
  ON "AssistantAdminControl"("tenantId", "controlKey");
CREATE INDEX "AssistantAdminControl_tenantId_rolloutMode_updatedAt_idx"
  ON "AssistantAdminControl"("tenantId", "rolloutMode", "updatedAt");
CREATE INDEX "AssistantAdminControl_tenantId_packetStatus_updatedAt_idx"
  ON "AssistantAdminControl"("tenantId", "packetStatus", "updatedAt");

ALTER TABLE "AssistantAdminControl"
  ADD CONSTRAINT "AssistantAdminControl_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantAdminControl_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
