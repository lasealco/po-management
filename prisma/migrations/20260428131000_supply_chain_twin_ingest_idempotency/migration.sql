-- AlterTable
ALTER TABLE "SupplyChainTwinIngestEvent" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex (PostgreSQL allows multiple NULL idempotencyKey per tenant)
CREATE UNIQUE INDEX "SupplyChainTwinIngestEvent_tenantId_idempotencyKey_key" ON "SupplyChainTwinIngestEvent"("tenantId", "idempotencyKey");
