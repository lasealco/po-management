-- SRM: lightweight commercial contract register per supplier (not tender/tariff/sourcing).

CREATE TYPE "SupplierContractRecordStatus" AS ENUM ('draft', 'active', 'expired', 'terminated');

CREATE TABLE "SupplierContractRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "externalReference" VARCHAR(128),
    "status" "SupplierContractRecordStatus" NOT NULL DEFAULT 'draft',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "referenceUrl" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierContractRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierContractRecord_tenantId_supplierId_idx" ON "SupplierContractRecord"("tenantId", "supplierId");

ALTER TABLE "SupplierContractRecord" ADD CONSTRAINT "SupplierContractRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierContractRecord" ADD CONSTRAINT "SupplierContractRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
