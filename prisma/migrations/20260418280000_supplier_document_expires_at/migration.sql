-- SRM: optional document expiry for compliance follow-up (metadata only).

ALTER TABLE "SupplierDocument" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "SupplierDocument_tenantId_supplierId_expiresAt_idx" ON "SupplierDocument"("tenantId", "supplierId", "expiresAt");
