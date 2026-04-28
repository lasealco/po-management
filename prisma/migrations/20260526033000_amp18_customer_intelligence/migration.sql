-- AMP18: customer service/account intelligence briefs with redacted evidence and logged reply approvals.
CREATE TABLE "AssistantCustomerBrief" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "crmAccountId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "serviceScore" INTEGER NOT NULL DEFAULT 0,
    "accountSnapshotJson" JSONB NOT NULL,
    "operationsSummaryJson" JSONB NOT NULL,
    "riskSummaryJson" JSONB NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "redactionJson" JSONB NOT NULL,
    "replyDraft" TEXT NOT NULL,
    "approvedReply" TEXT,
    "activityLogJson" JSONB,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantCustomerBrief_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantCustomerBrief_tenantId_crmAccountId_updatedAt_idx" ON "AssistantCustomerBrief"("tenantId", "crmAccountId", "updatedAt");
CREATE INDEX "AssistantCustomerBrief_tenantId_status_updatedAt_idx" ON "AssistantCustomerBrief"("tenantId", "status", "updatedAt");

ALTER TABLE "AssistantCustomerBrief"
    ADD CONSTRAINT "AssistantCustomerBrief_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantCustomerBrief"
    ADD CONSTRAINT "AssistantCustomerBrief_crmAccountId_fkey"
    FOREIGN KEY ("crmAccountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantCustomerBrief"
    ADD CONSTRAINT "AssistantCustomerBrief_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantCustomerBrief"
    ADD CONSTRAINT "AssistantCustomerBrief_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
