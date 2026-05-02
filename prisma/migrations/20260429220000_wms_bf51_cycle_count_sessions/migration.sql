-- BF-51 — structured cycle count sessions (submit → approve variance → ADJUSTMENT).

CREATE TYPE "WmsCycleCountSessionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'CLOSED', 'CANCELLED');

CREATE TYPE "WmsCycleCountLineStatus" AS ENUM ('PENDING_COUNT', 'MATCH_CLOSED', 'VARIANCE_PENDING', 'VARIANCE_POSTED');

CREATE TABLE "WmsCycleCountSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "referenceCode" VARCHAR(64) NOT NULL,
    "status" "WmsCycleCountSessionStatus" NOT NULL DEFAULT 'OPEN',
    "scopeNote" VARCHAR(500),
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsCycleCountSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsCycleCountSession_referenceCode_key" ON "WmsCycleCountSession"("referenceCode");

CREATE INDEX "WmsCycleCountSession_tenantId_warehouseId_status_idx" ON "WmsCycleCountSession"("tenantId", "warehouseId", "status");

ALTER TABLE "WmsCycleCountSession" ADD CONSTRAINT "WmsCycleCountSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsCycleCountSession" ADD CONSTRAINT "WmsCycleCountSession_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsCycleCountSession" ADD CONSTRAINT "WmsCycleCountSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WmsCycleCountLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "inventoryBalanceId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotCode" VARCHAR(120) NOT NULL DEFAULT '',
    "expectedQty" DECIMAL(14,3) NOT NULL,
    "countedQty" DECIMAL(14,3),
    "varianceReasonCode" VARCHAR(32),
    "varianceNote" VARCHAR(500),
    "status" "WmsCycleCountLineStatus" NOT NULL DEFAULT 'PENDING_COUNT',
    "inventoryMovementId" VARCHAR(128),

    CONSTRAINT "WmsCycleCountLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsCycleCountLine_inventoryMovementId_key" ON "WmsCycleCountLine"("inventoryMovementId");

CREATE UNIQUE INDEX "WmsCycleCountLine_sessionId_inventoryBalanceId_key" ON "WmsCycleCountLine"("sessionId", "inventoryBalanceId");

CREATE INDEX "WmsCycleCountLine_tenantId_sessionId_idx" ON "WmsCycleCountLine"("tenantId", "sessionId");

ALTER TABLE "WmsCycleCountLine" ADD CONSTRAINT "WmsCycleCountLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsCycleCountLine" ADD CONSTRAINT "WmsCycleCountLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WmsCycleCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsCycleCountLine" ADD CONSTRAINT "WmsCycleCountLine_inventoryBalanceId_fkey" FOREIGN KEY ("inventoryBalanceId") REFERENCES "InventoryBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WmsCycleCountLine" ADD CONSTRAINT "WmsCycleCountLine_binId_fkey" FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WmsCycleCountLine" ADD CONSTRAINT "WmsCycleCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
