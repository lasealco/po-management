-- AMP33: governed network design and footprint strategy packets.

CREATE TABLE "AssistantNetworkDesignPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "networkScore" INTEGER NOT NULL DEFAULT 0,
    "facilityCount" INTEGER NOT NULL DEFAULT 0,
    "laneCount" INTEGER NOT NULL DEFAULT 0,
    "customerNodeCount" INTEGER NOT NULL DEFAULT 0,
    "supplierNodeCount" INTEGER NOT NULL DEFAULT 0,
    "scenarioCount" INTEGER NOT NULL DEFAULT 0,
    "serviceRiskCount" INTEGER NOT NULL DEFAULT 0,
    "costRiskCount" INTEGER NOT NULL DEFAULT 0,
    "recommendedScenarioKey" VARCHAR(128),
    "baselineJson" JSONB NOT NULL,
    "scenarioJson" JSONB NOT NULL,
    "tradeoffJson" JSONB NOT NULL,
    "serviceImpactJson" JSONB NOT NULL,
    "riskExposureJson" JSONB NOT NULL,
    "approvalPlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantNetworkDesignPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantNetworkDesignPacket_tenantId_status_updatedAt_idx" ON "AssistantNetworkDesignPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantNetworkDesignPacket_tenantId_networkScore_updatedAt_idx" ON "AssistantNetworkDesignPacket"("tenantId", "networkScore", "updatedAt");
CREATE INDEX "AssistantNetworkDesignPacket_tenantId_recommendedScenarioKey_updatedAt_idx" ON "AssistantNetworkDesignPacket"("tenantId", "recommendedScenarioKey", "updatedAt");

ALTER TABLE "AssistantNetworkDesignPacket" ADD CONSTRAINT "AssistantNetworkDesignPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantNetworkDesignPacket" ADD CONSTRAINT "AssistantNetworkDesignPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantNetworkDesignPacket" ADD CONSTRAINT "AssistantNetworkDesignPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
