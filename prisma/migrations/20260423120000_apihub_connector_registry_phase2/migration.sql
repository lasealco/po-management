-- API hub Phase 2: connector lifecycle updates + lightweight audit trail.

CREATE TABLE "ApiHubConnectorAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiHubConnectorAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiHubConnectorAuditLog_tenantId_createdAt_idx" ON "ApiHubConnectorAuditLog"("tenantId", "createdAt");
CREATE INDEX "ApiHubConnectorAuditLog_connectorId_createdAt_idx" ON "ApiHubConnectorAuditLog"("connectorId", "createdAt");
CREATE INDEX "ApiHubConnectorAuditLog_actorUserId_createdAt_idx" ON "ApiHubConnectorAuditLog"("actorUserId", "createdAt");

ALTER TABLE "ApiHubConnectorAuditLog"
  ADD CONSTRAINT "ApiHubConnectorAuditLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiHubConnectorAuditLog"
  ADD CONSTRAINT "ApiHubConnectorAuditLog_connectorId_fkey"
  FOREIGN KEY ("connectorId") REFERENCES "ApiHubConnector"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiHubConnectorAuditLog"
  ADD CONSTRAINT "ApiHubConnectorAuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
