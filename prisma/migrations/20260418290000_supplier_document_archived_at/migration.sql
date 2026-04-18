-- SRM: soft-archive supplier document evidence (document control; not performance/risk/tender/tariff).

ALTER TABLE "SupplierDocument" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "SupplierDocument_tenantId_supplierId_archivedAt_idx" ON "SupplierDocument"("tenantId", "supplierId", "archivedAt");
