-- MP4: Assistant email pilot — inbound rows + staged reply (no auto-send).

CREATE TYPE "AssistantEmailThreadStatus" AS ENUM ('OPEN', 'REPLIED', 'RESOLVED');

CREATE TABLE "AssistantEmailThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerMsgId" VARCHAR(500),
    "subject" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "preview" VARCHAR(500) NOT NULL,
    "bodyText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "AssistantEmailThreadStatus" NOT NULL DEFAULT 'OPEN',
    "draftReply" TEXT,
    "lastSendConfirmAt" TIMESTAMP(3),
    "lastSendConfirmById" TEXT,
    "lastSendMode" VARCHAR(32),
    "linkedCrmAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantEmailThread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantEmailThread_tenantId_receivedAt_idx" ON "AssistantEmailThread"("tenantId", "receivedAt");

CREATE INDEX "AssistantEmailThread_tenantId_status_idx" ON "AssistantEmailThread"("tenantId", "status");

CREATE UNIQUE INDEX "AssistantEmailThread_tenantId_providerMsgId_key" ON "AssistantEmailThread"("tenantId", "providerMsgId");

ALTER TABLE "AssistantEmailThread" ADD CONSTRAINT "AssistantEmailThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantEmailThread" ADD CONSTRAINT "AssistantEmailThread_lastSendConfirmById_fkey" FOREIGN KEY ("lastSendConfirmById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantEmailThread" ADD CONSTRAINT "AssistantEmailThread_linkedCrmAccountId_fkey" FOREIGN KEY ("linkedCrmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
