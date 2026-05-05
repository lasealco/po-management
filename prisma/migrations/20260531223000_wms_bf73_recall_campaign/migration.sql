-- BF-73 — recall campaign scope rows; materialize applies BF-58 inventory freeze to balances.

CREATE TYPE "WmsRecallCampaignStatus" AS ENUM ('DRAFT', 'MATERIALIZED', 'CLOSED');

CREATE TABLE "WmsRecallCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignCode" VARCHAR(80) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "note" VARCHAR(2000),
    "status" "WmsRecallCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scopeJson" JSONB NOT NULL,
    "holdReasonCode" VARCHAR(32) NOT NULL DEFAULT 'RECALL',
    "holdReleaseGrant" VARCHAR(128),
    "materializedAt" TIMESTAMP(3),
    "frozenBalanceCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "WmsRecallCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsRecallCampaign_tenantId_campaignCode_key" ON "WmsRecallCampaign"("tenantId", "campaignCode");
CREATE INDEX "WmsRecallCampaign_tenantId_status_idx" ON "WmsRecallCampaign"("tenantId", "status");

ALTER TABLE "WmsRecallCampaign" ADD CONSTRAINT "WmsRecallCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsRecallCampaign" ADD CONSTRAINT "WmsRecallCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
