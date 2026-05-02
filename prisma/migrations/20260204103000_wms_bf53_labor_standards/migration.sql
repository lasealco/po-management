-- BF-53 — labor standards per task type + task timing columns.

CREATE TABLE "WmsLaborTaskStandard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskType" "WmsTaskType" NOT NULL,
    "standardMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsLaborTaskStandard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsLaborTaskStandard_tenantId_taskType_key" ON "WmsLaborTaskStandard"("tenantId", "taskType");

CREATE INDEX "WmsLaborTaskStandard_tenantId_idx" ON "WmsLaborTaskStandard"("tenantId");

ALTER TABLE "WmsLaborTaskStandard" ADD CONSTRAINT "WmsLaborTaskStandard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsTask" ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "standardMinutes" INTEGER;
