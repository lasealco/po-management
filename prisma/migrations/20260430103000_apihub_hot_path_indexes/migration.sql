-- API Hub Slice 58: hot-path indexes for list/filter, in-flight counts, retry-tree walks, and audit scans.

CREATE INDEX "ApiHubIngestionRun_tenantId_connectorId_createdAt_idx" ON "ApiHubIngestionRun"("tenantId", "connectorId", "createdAt");

CREATE INDEX "ApiHubIngestionRun_tenantId_connectorId_status_idx" ON "ApiHubIngestionRun"("tenantId", "connectorId", "status");

CREATE INDEX "ApiHubIngestionRun_tenantId_triggerKind_createdAt_idx" ON "ApiHubIngestionRun"("tenantId", "triggerKind", "createdAt");

CREATE INDEX "ApiHubIngestionRun_tenantId_retryOfRunId_idx" ON "ApiHubIngestionRun"("tenantId", "retryOfRunId");

CREATE INDEX "ApiHubIngestionRunAuditLog_tenantId_action_createdAt_idx" ON "ApiHubIngestionRunAuditLog"("tenantId", "action", "createdAt");

CREATE INDEX "ApiHubConnector_tenantId_status_createdAt_idx" ON "ApiHubConnector"("tenantId", "status", "createdAt");

CREATE INDEX "ApiHubConnector_tenantId_authMode_createdAt_idx" ON "ApiHubConnector"("tenantId", "authMode", "createdAt");

CREATE INDEX "ApiHubConnector_tenantId_updatedAt_idx" ON "ApiHubConnector"("tenantId", "updatedAt");
