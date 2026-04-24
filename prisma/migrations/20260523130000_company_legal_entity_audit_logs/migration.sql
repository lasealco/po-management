-- CreateTable
CREATE TABLE "company_legal_entity_audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyLegalEntityId" TEXT,
    "orgUnitId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_legal_entity_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_legal_entity_audit_logs_tenantId_createdAt_idx" ON "company_legal_entity_audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "company_legal_entity_audit_logs_orgUnitId_idx" ON "company_legal_entity_audit_logs"("orgUnitId");

-- CreateIndex
CREATE INDEX "company_legal_entity_audit_logs_companyLegalEntityId_idx" ON "company_legal_entity_audit_logs"("companyLegalEntityId");

-- CreateIndex
CREATE INDEX "company_legal_entity_audit_logs_actorUserId_idx" ON "company_legal_entity_audit_logs"("actorUserId");

-- AddForeignKey
ALTER TABLE "company_legal_entity_audit_logs" ADD CONSTRAINT "company_legal_entity_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_legal_entity_audit_logs" ADD CONSTRAINT "company_legal_entity_audit_logs_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_legal_entity_audit_logs" ADD CONSTRAINT "company_legal_entity_audit_logs_companyLegalEntityId_fkey" FOREIGN KEY ("companyLegalEntityId") REFERENCES "company_legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_legal_entity_audit_logs" ADD CONSTRAINT "company_legal_entity_audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
