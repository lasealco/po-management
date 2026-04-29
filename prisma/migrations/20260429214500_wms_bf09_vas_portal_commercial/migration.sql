-- BF-09 — VAS customer-portal intake + optional CRM + manual commercial estimates on `WmsWorkOrder`.

CREATE TYPE "WmsWorkOrderIntakeChannel" AS ENUM ('OPS', 'CUSTOMER_PORTAL');

ALTER TABLE "WmsWorkOrder" ADD COLUMN "intakeChannel" "WmsWorkOrderIntakeChannel" NOT NULL DEFAULT 'OPS';
ALTER TABLE "WmsWorkOrder" ADD COLUMN "crmAccountId" TEXT;
ALTER TABLE "WmsWorkOrder" ADD COLUMN "estimatedMaterialsCents" INTEGER;
ALTER TABLE "WmsWorkOrder" ADD COLUMN "estimatedLaborMinutes" INTEGER;

ALTER TABLE "WmsWorkOrder" ADD CONSTRAINT "WmsWorkOrder_crmAccountId_fkey" FOREIGN KEY ("crmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WmsWorkOrder_tenantId_crmAccountId_idx" ON "WmsWorkOrder"("tenantId", "crmAccountId");
