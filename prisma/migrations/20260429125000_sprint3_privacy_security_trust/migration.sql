-- Sprint 3: durable Privacy, Security & Trust packets.
CREATE TABLE "AssistantPrivacySecurityTrustPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "privacyRiskCount" INTEGER NOT NULL DEFAULT 0,
    "dsrRequestCount" INTEGER NOT NULL DEFAULT 0,
    "transferRiskCount" INTEGER NOT NULL DEFAULT 0,
    "identityRiskCount" INTEGER NOT NULL DEFAULT 0,
    "securityExceptionCount" INTEGER NOT NULL DEFAULT 0,
    "threatSignalCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "consentPostureJson" JSONB NOT NULL,
    "dataSubjectRightsJson" JSONB NOT NULL,
    "dataTransferJson" JSONB NOT NULL,
    "identityAccessJson" JSONB NOT NULL,
    "securityExceptionJson" JSONB NOT NULL,
    "threatExposureJson" JSONB NOT NULL,
    "trustAssuranceJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantPrivacySecurityTrustPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantPrivacySecurityTrustPacket_tenantId_status_updatedAt_idx" ON "AssistantPrivacySecurityTrustPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantPrivacySecurityTrustPacket_tenantId_trustScore_updatedAt_idx" ON "AssistantPrivacySecurityTrustPacket"("tenantId", "trustScore", "updatedAt");

ALTER TABLE "AssistantPrivacySecurityTrustPacket" ADD CONSTRAINT "AssistantPrivacySecurityTrustPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantPrivacySecurityTrustPacket" ADD CONSTRAINT "AssistantPrivacySecurityTrustPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantPrivacySecurityTrustPacket" ADD CONSTRAINT "AssistantPrivacySecurityTrustPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
