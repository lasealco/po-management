-- SRM: supplier document register (metadata + optional HTTPS reference URL).

CREATE TYPE "SupplierDocumentCategory" AS ENUM (
  'insurance',
  'license',
  'certificate',
  'compliance_other',
  'commercial_other'
);

CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "category" "SupplierDocumentCategory" NOT NULL DEFAULT 'compliance_other',
    "referenceUrl" VARCHAR(2000),
    "notes" TEXT,
    "documentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierDocument_tenantId_supplierId_idx" ON "SupplierDocument"("tenantId", "supplierId");

ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
