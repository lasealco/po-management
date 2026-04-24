-- Phase 1: in-tenant legal / document profile per org node (distinct from tariff `legal_entities` / TariffLegalEntity).

CREATE TABLE "company_legal_entities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "registeredLegalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "taxVatId" TEXT,
    "taxLocalId" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "addressCity" TEXT,
    "addressRegion" TEXT,
    "addressPostalCode" TEXT,
    "addressCountryCode" VARCHAR(2),
    "phone" TEXT,
    "companyEmail" TEXT,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_legal_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_legal_entities_orgUnitId_key" ON "company_legal_entities"("orgUnitId");

CREATE INDEX "company_legal_entities_tenantId_idx" ON "company_legal_entities"("tenantId");

ALTER TABLE "company_legal_entities" ADD CONSTRAINT "company_legal_entities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_legal_entities" ADD CONSTRAINT "company_legal_entities_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
