-- AMP27: Voice and meeting intelligence assistant persistence.

CREATE TABLE "AssistantMeetingIntelligencePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "meetingScore" INTEGER NOT NULL DEFAULT 0,
    "transcriptCount" INTEGER NOT NULL DEFAULT 0,
    "extractedActionCount" INTEGER NOT NULL DEFAULT 0,
    "riskCount" INTEGER NOT NULL DEFAULT 0,
    "decisionCount" INTEGER NOT NULL DEFAULT 0,
    "redactionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "transcriptDigestJson" JSONB NOT NULL,
    "extractedActionJson" JSONB NOT NULL,
    "riskJson" JSONB NOT NULL,
    "decisionJson" JSONB NOT NULL,
    "objectLinkJson" JSONB NOT NULL,
    "redactionJson" JSONB NOT NULL,
    "minutesJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantMeetingIntelligencePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantMeetingIntelligencePacket_tenantId_status_updatedAt_idx" ON "AssistantMeetingIntelligencePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantMeetingIntelligencePacket_tenantId_meetingScore_updatedAt_idx" ON "AssistantMeetingIntelligencePacket"("tenantId", "meetingScore", "updatedAt");

ALTER TABLE "AssistantMeetingIntelligencePacket" ADD CONSTRAINT "AssistantMeetingIntelligencePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantMeetingIntelligencePacket" ADD CONSTRAINT "AssistantMeetingIntelligencePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantMeetingIntelligencePacket" ADD CONSTRAINT "AssistantMeetingIntelligencePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
