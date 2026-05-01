-- BF-24 — first-class aisle master + optional bin link
CREATE TABLE "WarehouseAisle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "originXMm" INTEGER,
    "originYMm" INTEGER,
    "originZMm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseAisle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseAisle_warehouseId_code_key" ON "WarehouseAisle"("warehouseId", "code");
CREATE INDEX "WarehouseAisle_tenantId_warehouseId_idx" ON "WarehouseAisle"("tenantId", "warehouseId");
CREATE INDEX "WarehouseAisle_zoneId_idx" ON "WarehouseAisle"("zoneId");

ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseBin" ADD COLUMN "warehouseAisleId" TEXT;
CREATE INDEX "WarehouseBin_warehouseAisleId_idx" ON "WarehouseBin"("warehouseAisleId");
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_warehouseAisleId_fkey" FOREIGN KEY ("warehouseAisleId") REFERENCES "WarehouseAisle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
