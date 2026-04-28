-- AMP15: warehouse labor/capacity command plans.
CREATE TABLE "AssistantWarehouseCapacityPlan" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "warehouseId" TEXT,
  "title" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "capacityScore" INTEGER NOT NULL DEFAULT 0,
  "taskSummaryJson" JSONB NOT NULL,
  "bottleneckJson" JSONB NOT NULL,
  "recoveryPlanJson" JSONB NOT NULL,
  "actionQueueItemId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantWarehouseCapacityPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantWarehouseCapacityPlan_tenantId_status_updatedAt_idx"
  ON "AssistantWarehouseCapacityPlan"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantWarehouseCapacityPlan_tenantId_warehouseId_createdAt_idx"
  ON "AssistantWarehouseCapacityPlan"("tenantId", "warehouseId", "createdAt");

ALTER TABLE "AssistantWarehouseCapacityPlan"
  ADD CONSTRAINT "AssistantWarehouseCapacityPlan_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantWarehouseCapacityPlan_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
