-- BF-55 — stock transfer orders + STO_SHIP / STO_RECEIVE movement types.
CREATE TYPE "WmsStockTransferStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

ALTER TYPE "InventoryMovementType" ADD VALUE 'STO_SHIP';
ALTER TYPE "InventoryMovementType" ADD VALUE 'STO_RECEIVE';

CREATE TABLE "WmsStockTransfer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referenceCode" VARCHAR(64) NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "WmsStockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "note" VARCHAR(500),
    "createdById" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsStockTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsStockTransfer_referenceCode_key" ON "WmsStockTransfer"("referenceCode");
CREATE INDEX "WmsStockTransfer_tenantId_status_idx" ON "WmsStockTransfer"("tenantId", "status");
CREATE INDEX "WmsStockTransfer_tenantId_fromWarehouseId_idx" ON "WmsStockTransfer"("tenantId", "fromWarehouseId");
CREATE INDEX "WmsStockTransfer_tenantId_toWarehouseId_idx" ON "WmsStockTransfer"("tenantId", "toWarehouseId");

CREATE TABLE "WmsStockTransferLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "lotCode" VARCHAR(120) NOT NULL DEFAULT '',
    "quantityOrdered" DECIMAL(14,3) NOT NULL,
    "quantityShipped" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "quantityReceived" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "fromBinId" TEXT NOT NULL,
    "toBinId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsStockTransferLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsStockTransferLine_transferId_lineNo_key" ON "WmsStockTransferLine"("transferId", "lineNo");
CREATE INDEX "WmsStockTransferLine_tenantId_transferId_idx" ON "WmsStockTransferLine"("tenantId", "transferId");

ALTER TABLE "WmsStockTransfer" ADD CONSTRAINT "WmsStockTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsStockTransfer" ADD CONSTRAINT "WmsStockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WmsStockTransfer" ADD CONSTRAINT "WmsStockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WmsStockTransfer" ADD CONSTRAINT "WmsStockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WmsStockTransferLine" ADD CONSTRAINT "WmsStockTransferLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsStockTransferLine" ADD CONSTRAINT "WmsStockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "WmsStockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsStockTransferLine" ADD CONSTRAINT "WmsStockTransferLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WmsStockTransferLine" ADD CONSTRAINT "WmsStockTransferLine_fromBinId_fkey" FOREIGN KEY ("fromBinId") REFERENCES "WarehouseBin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WmsStockTransferLine" ADD CONSTRAINT "WmsStockTransferLine_toBinId_fkey" FOREIGN KEY ("toBinId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
