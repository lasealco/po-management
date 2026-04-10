CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'PUTAWAY', 'PICK', 'ADJUSTMENT', 'SHIPMENT');
CREATE TYPE "WmsTaskType" AS ENUM ('PUTAWAY', 'PICK', 'CYCLE_COUNT');
CREATE TYPE "WmsTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

CREATE TABLE "WarehouseBin" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WarehouseBin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBalance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "binId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "onHandQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "allocatedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "binId" TEXT,
  "productId" TEXT NOT NULL,
  "movementType" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WmsTask" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "taskType" "WmsTaskType" NOT NULL,
  "status" "WmsTaskStatus" NOT NULL DEFAULT 'OPEN',
  "shipmentId" TEXT,
  "orderId" TEXT,
  "productId" TEXT,
  "binId" TEXT,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WmsTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseBin_warehouseId_code_key" ON "WarehouseBin"("warehouseId", "code");
CREATE INDEX "WarehouseBin_tenantId_warehouseId_idx" ON "WarehouseBin"("tenantId", "warehouseId");
CREATE UNIQUE INDEX "InventoryBalance_warehouseId_binId_productId_key" ON "InventoryBalance"("warehouseId", "binId", "productId");
CREATE INDEX "InventoryBalance_tenantId_warehouseId_idx" ON "InventoryBalance"("tenantId", "warehouseId");
CREATE INDEX "InventoryMovement_tenantId_warehouseId_createdAt_idx" ON "InventoryMovement"("tenantId", "warehouseId", "createdAt");
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");
CREATE INDEX "WmsTask_tenantId_warehouseId_status_taskType_idx" ON "WmsTask"("tenantId", "warehouseId", "status", "taskType");
CREATE INDEX "WmsTask_referenceType_referenceId_idx" ON "WmsTask"("referenceType", "referenceId");

ALTER TABLE "WarehouseBin"
  ADD CONSTRAINT "WarehouseBin_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseBin"
  ADD CONSTRAINT "WarehouseBin_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_binId_fkey"
  FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_binId_fkey"
  FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_binId_fkey"
  FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WmsTask"
  ADD CONSTRAINT "WmsTask_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
