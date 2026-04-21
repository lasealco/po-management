-- API Hub ingestion run lifecycle audit (Slice 45): apply/retry root-cause metadata
CREATE TABLE "ApiHubIngestionRunAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ingestionRunId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiHubIngestionRunAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiHubIngestionRunAuditLog_tenantId_createdAt_idx" ON "ApiHubIngestionRunAuditLog"("tenantId", "createdAt");

CREATE INDEX "ApiHubIngestionRunAuditLog_ingestionRunId_createdAt_idx" ON "ApiHubIngestionRunAuditLog"("ingestionRunId", "createdAt");

CREATE INDEX "ApiHubIngestionRunAuditLog_actorUserId_createdAt_idx" ON "ApiHubIngestionRunAuditLog"("actorUserId", "createdAt");

ALTER TABLE "ApiHubIngestionRunAuditLog" ADD CONSTRAINT "ApiHubIngestionRunAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiHubIngestionRunAuditLog" ADD CONSTRAINT "ApiHubIngestionRunAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
