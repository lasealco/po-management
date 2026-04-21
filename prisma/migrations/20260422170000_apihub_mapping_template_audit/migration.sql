-- CreateTable
CREATE TABLE "ApiHubMappingTemplateAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiHubMappingTemplateAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiHubMappingTemplateAuditLog_tenantId_templateId_createdAt_idx" ON "ApiHubMappingTemplateAuditLog"("tenantId", "templateId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiHubMappingTemplateAuditLog_tenantId_createdAt_idx" ON "ApiHubMappingTemplateAuditLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApiHubMappingTemplateAuditLog" ADD CONSTRAINT "ApiHubMappingTemplateAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiHubMappingTemplateAuditLog" ADD CONSTRAINT "ApiHubMappingTemplateAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
