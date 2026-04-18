-- SRM: manual supplier workspace alerts (not automated sourcing/tender/tariff).

CREATE TYPE "SupplierSrmAlertSeverity" AS ENUM ('info', 'warning', 'critical');
CREATE TYPE "SupplierSrmAlertStatus" AS ENUM ('open', 'resolved');

CREATE TABLE "SupplierSrmAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "SupplierSrmAlertSeverity" NOT NULL DEFAULT 'warning',
    "status" "SupplierSrmAlertStatus" NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierSrmAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierSrmAlert_tenantId_supplierId_idx" ON "SupplierSrmAlert"("tenantId", "supplierId");

ALTER TABLE "SupplierSrmAlert" ADD CONSTRAINT "SupplierSrmAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierSrmAlert" ADD CONSTRAINT "SupplierSrmAlert_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
