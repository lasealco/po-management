-- AMP13: governed demand-to-order orchestration plans.
CREATE TABLE "AssistantOrderOrchestrationPlan" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "sourceKind" VARCHAR(64) NOT NULL DEFAULT 'manual_prompt',
  "sourceText" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "customerCrmAccountId" TEXT,
  "salesOrderId" TEXT,
  "actionQueueItemId" TEXT,
  "requestedDeliveryDate" TIMESTAMP(3),
  "demandJson" JSONB NOT NULL,
  "matchJson" JSONB NOT NULL,
  "atpJson" JSONB NOT NULL,
  "proposalJson" JSONB NOT NULL,
  "approvalNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantOrderOrchestrationPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantOrderOrchestrationPlan_tenantId_status_updatedAt_idx"
  ON "AssistantOrderOrchestrationPlan"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantOrderOrchestrationPlan_tenantId_customerCrmAccountId_createdAt_idx"
  ON "AssistantOrderOrchestrationPlan"("tenantId", "customerCrmAccountId", "createdAt");
CREATE INDEX "AssistantOrderOrchestrationPlan_tenantId_salesOrderId_idx"
  ON "AssistantOrderOrchestrationPlan"("tenantId", "salesOrderId");

ALTER TABLE "AssistantOrderOrchestrationPlan"
  ADD CONSTRAINT "AssistantOrderOrchestrationPlan_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantOrderOrchestrationPlan_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
