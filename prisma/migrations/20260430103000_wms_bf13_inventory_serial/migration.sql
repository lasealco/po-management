-- BF-13 — unit serial registry + optional balance pointer + movement genealogy links (`WmsInventorySerial`, `WmsInventorySerialMovement`).

CREATE TABLE "WmsInventorySerial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNo" VARCHAR(120) NOT NULL,
    "note" VARCHAR(500),
    "currentBalanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsInventorySerial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WmsInventorySerialMovement" (
    "id" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "inventoryMovementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsInventorySerialMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsInventorySerial_tenantId_productId_serialNo_key" ON "WmsInventorySerial"("tenantId", "productId", "serialNo");
CREATE INDEX "WmsInventorySerial_tenantId_serialNo_idx" ON "WmsInventorySerial"("tenantId", "serialNo");
CREATE UNIQUE INDEX "WmsInventorySerialMovement_serialId_inventoryMovementId_key" ON "WmsInventorySerialMovement"("serialId", "inventoryMovementId");
CREATE INDEX "WmsInventorySerialMovement_inventoryMovementId_idx" ON "WmsInventorySerialMovement"("inventoryMovementId");

ALTER TABLE "WmsInventorySerial" ADD CONSTRAINT "WmsInventorySerial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsInventorySerial" ADD CONSTRAINT "WmsInventorySerial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsInventorySerial" ADD CONSTRAINT "WmsInventorySerial_currentBalanceId_fkey" FOREIGN KEY ("currentBalanceId") REFERENCES "InventoryBalance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WmsInventorySerialMovement" ADD CONSTRAINT "WmsInventorySerialMovement_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "WmsInventorySerial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsInventorySerialMovement" ADD CONSTRAINT "WmsInventorySerialMovement_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
