-- BF-36 — Soft reservations (TTL) against inventory balances for ATP / allocation.

CREATE TABLE "WmsInventorySoftReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "inventoryBalanceId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "referenceType" VARCHAR(80),
    "referenceId" VARCHAR(128),
    "note" VARCHAR(500),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsInventorySoftReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WmsInventorySoftReservation_tenantId_warehouseId_expiresAt_idx" ON "WmsInventorySoftReservation" ("tenantId", "warehouseId", "expiresAt");

CREATE INDEX "WmsInventorySoftReservation_inventoryBalanceId_idx" ON "WmsInventorySoftReservation" ("inventoryBalanceId");

ALTER TABLE "WmsInventorySoftReservation" ADD CONSTRAINT "WmsInventorySoftReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsInventorySoftReservation" ADD CONSTRAINT "WmsInventorySoftReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsInventorySoftReservation" ADD CONSTRAINT "WmsInventorySoftReservation_inventoryBalanceId_fkey" FOREIGN KEY ("inventoryBalanceId") REFERENCES "InventoryBalance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsInventorySoftReservation" ADD CONSTRAINT "WmsInventorySoftReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
