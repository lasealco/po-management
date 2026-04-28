-- AMP30: Multi-tenant rollout and implementation factory assistant persistence.

CREATE TABLE "AssistantRolloutFactoryPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "templateAssetCount" INTEGER NOT NULL DEFAULT 0,
    "roleGrantGapCount" INTEGER NOT NULL DEFAULT 0,
    "moduleGapCount" INTEGER NOT NULL DEFAULT 0,
    "seedGapCount" INTEGER NOT NULL DEFAULT 0,
    "rollbackStepCount" INTEGER NOT NULL DEFAULT 0,
    "sourceTenantJson" JSONB NOT NULL,
    "templateInventoryJson" JSONB NOT NULL,
    "roleGrantPlanJson" JSONB NOT NULL,
    "moduleFlagPlanJson" JSONB NOT NULL,
    "demoDataPlanJson" JSONB NOT NULL,
    "readinessCheckJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "onboardingPacketJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantRolloutFactoryPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantRolloutFactoryPacket_tenantId_status_updatedAt_idx" ON "AssistantRolloutFactoryPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantRolloutFactoryPacket_tenantId_readinessScore_updatedAt_idx" ON "AssistantRolloutFactoryPacket"("tenantId", "readinessScore", "updatedAt");

ALTER TABLE "AssistantRolloutFactoryPacket" ADD CONSTRAINT "AssistantRolloutFactoryPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantRolloutFactoryPacket" ADD CONSTRAINT "AssistantRolloutFactoryPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantRolloutFactoryPacket" ADD CONSTRAINT "AssistantRolloutFactoryPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
