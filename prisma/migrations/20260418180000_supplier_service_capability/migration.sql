-- SRM: service capabilities per supplier (modes, service type, geography).

CREATE TABLE "SupplierServiceCapability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "mode" VARCHAR(16),
    "subMode" VARCHAR(64),
    "serviceType" VARCHAR(128) NOT NULL,
    "geography" VARCHAR(256),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierServiceCapability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierServiceCapability_tenantId_supplierId_idx" ON "SupplierServiceCapability"("tenantId", "supplierId");

ALTER TABLE "SupplierServiceCapability" ADD CONSTRAINT "SupplierServiceCapability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierServiceCapability" ADD CONSTRAINT "SupplierServiceCapability_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
