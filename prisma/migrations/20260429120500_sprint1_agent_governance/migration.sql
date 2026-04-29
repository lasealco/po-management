-- Sprint 1: durable Agent Governance Control Plane packets.
CREATE TABLE "AssistantAgentGovernancePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "certifiedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "governanceScore" INTEGER NOT NULL DEFAULT 0,
    "agentCount" INTEGER NOT NULL DEFAULT 0,
    "highRiskAgentCount" INTEGER NOT NULL DEFAULT 0,
    "toolScopeCount" INTEGER NOT NULL DEFAULT 0,
    "promptAssetCount" INTEGER NOT NULL DEFAULT 0,
    "memoryPolicyCount" INTEGER NOT NULL DEFAULT 0,
    "observabilitySignalCount" INTEGER NOT NULL DEFAULT 0,
    "agentRegistryJson" JSONB NOT NULL,
    "toolScopeJson" JSONB NOT NULL,
    "promptSupplyChainJson" JSONB NOT NULL,
    "memoryGovernanceJson" JSONB NOT NULL,
    "observabilityJson" JSONB NOT NULL,
    "certificationPlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "certifiedAt" TIMESTAMP(3),
    "certificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantAgentGovernancePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantAgentGovernancePacket_tenantId_status_updatedAt_idx" ON "AssistantAgentGovernancePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantAgentGovernancePacket_tenantId_governanceScore_updated_idx" ON "AssistantAgentGovernancePacket"("tenantId", "governanceScore", "updatedAt");

ALTER TABLE "AssistantAgentGovernancePacket" ADD CONSTRAINT "AssistantAgentGovernancePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantAgentGovernancePacket" ADD CONSTRAINT "AssistantAgentGovernancePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantAgentGovernancePacket" ADD CONSTRAINT "AssistantAgentGovernancePacket_certifiedByUserId_fkey" FOREIGN KEY ("certifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
