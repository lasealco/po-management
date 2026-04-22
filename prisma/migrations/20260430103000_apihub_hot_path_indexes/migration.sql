-- API Hub Slice 58: hot-path indexes for list/filter, in-flight counts, retry-tree walks, and audit scans.
-- IF NOT EXISTS: recover cleanly when a prior attempt created early indexes before failing on a later statement.

CREATE INDEX IF NOT EXISTS "ApiHubIngestionRun_tenantId_connectorId_createdAt_idx" ON "ApiHubIngestionRun"("tenantId", "connectorId", "createdAt");

CREATE INDEX IF NOT EXISTS "ApiHubIngestionRun_tenantId_connectorId_status_idx" ON "ApiHubIngestionRun"("tenantId", "connectorId", "status");

CREATE INDEX IF NOT EXISTS "ApiHubIngestionRun_tenantId_triggerKind_createdAt_idx" ON "ApiHubIngestionRun"("tenantId", "triggerKind", "createdAt");

CREATE INDEX IF NOT EXISTS "ApiHubIngestionRun_tenantId_retryOfRunId_idx" ON "ApiHubIngestionRun"("tenantId", "retryOfRunId");

CREATE INDEX IF NOT EXISTS "ApiHubIngestionRunAuditLog_tenantId_action_createdAt_idx" ON "ApiHubIngestionRunAuditLog"("tenantId", "action", "createdAt");

CREATE INDEX IF NOT EXISTS "ApiHubConnector_tenantId_status_createdAt_idx" ON "ApiHubConnector"("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ApiHubConnector_tenantId_authMode_createdAt_idx" ON "ApiHubConnector"("tenantId", "authMode", "createdAt");

CREATE INDEX IF NOT EXISTS "ApiHubConnector_tenantId_updatedAt_idx" ON "ApiHubConnector"("tenantId", "updatedAt");
