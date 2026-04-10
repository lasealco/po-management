CREATE TYPE "WarehouseZoneType" AS ENUM ('RECEIVING', 'PICKING', 'RESERVE', 'QUARANTINE', 'STAGING', 'SHIPPING');
CREATE TYPE "BinStorageType" AS ENUM ('PALLET', 'FLOOR', 'SHELF', 'QUARANTINE', 'STAGING');
ALTER TYPE "WmsTaskType" ADD VALUE IF NOT EXISTS 'REPLENISH';
CREATE TYPE "OutboundOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'PICKING', 'PACKED', 'SHIPPED', 'CANCELLED');

CREATE TABLE "WarehouseZone" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "zoneType" "WarehouseZoneType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WarehouseBin"
  ADD COLUMN "zoneId" TEXT,
  ADD COLUMN "storageType" "BinStorageType" NOT NULL DEFAULT 'PALLET',
  ADD COLUMN "isPickFace" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxPallets" INTEGER;

CREATE TABLE "ReplenishmentRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sourceZoneId" TEXT,
  "targetZoneId" TEXT,
  "minPickQty" DECIMAL(14,3) NOT NULL,
  "maxPickQty" DECIMAL(14,3) NOT NULL,
  "replenishQty" DECIMAL(14,3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReplenishmentRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "outboundNo" TEXT NOT NULL,
  "customerRef" TEXT,
  "shipToName" TEXT,
  "shipToLine1" TEXT,
  "shipToCity" TEXT,
  "shipToCountryCode" VARCHAR(2),
  "requestedShipDate" TIMESTAMP(3),
  "status" "OutboundOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundOrderLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "outboundOrderId" TEXT NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "pickedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "packedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "shippedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseZone_warehouseId_code_key" ON "WarehouseZone"("warehouseId", "code");
CREATE INDEX "WarehouseZone_tenantId_warehouseId_zoneType_idx" ON "WarehouseZone"("tenantId", "warehouseId", "zoneType");
CREATE INDEX "WarehouseBin_zoneId_idx" ON "WarehouseBin"("zoneId");
CREATE UNIQUE INDEX "ReplenishmentRule_warehouseId_productId_key" ON "ReplenishmentRule"("warehouseId", "productId");
CREATE INDEX "ReplenishmentRule_tenantId_warehouseId_idx" ON "ReplenishmentRule"("tenantId", "warehouseId");
CREATE UNIQUE INDEX "OutboundOrder_tenantId_outboundNo_key" ON "OutboundOrder"("tenantId", "outboundNo");
CREATE INDEX "OutboundOrder_tenantId_warehouseId_status_idx" ON "OutboundOrder"("tenantId", "warehouseId", "status");
CREATE UNIQUE INDEX "OutboundOrderLine_outboundOrderId_lineNo_key" ON "OutboundOrderLine"("outboundOrderId", "lineNo");
CREATE INDEX "OutboundOrderLine_tenantId_outboundOrderId_idx" ON "OutboundOrderLine"("tenantId", "outboundOrderId");

ALTER TABLE "WarehouseZone"
  ADD CONSTRAINT "WarehouseZone_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseZone"
  ADD CONSTRAINT "WarehouseZone_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseBin"
  ADD CONSTRAINT "WarehouseBin_zoneId_fkey"
  FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_sourceZoneId_fkey"
  FOREIGN KEY ("sourceZoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReplenishmentRule"
  ADD CONSTRAINT "ReplenishmentRule_targetZoneId_fkey"
  FOREIGN KEY ("targetZoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundOrder"
  ADD CONSTRAINT "OutboundOrder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundOrder"
  ADD CONSTRAINT "OutboundOrder_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundOrder"
  ADD CONSTRAINT "OutboundOrder_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutboundOrderLine"
  ADD CONSTRAINT "OutboundOrderLine_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundOrderLine"
  ADD CONSTRAINT "OutboundOrderLine_outboundOrderId_fkey"
  FOREIGN KEY ("outboundOrderId") REFERENCES "OutboundOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundOrderLine"
  ADD CONSTRAINT "OutboundOrderLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
