-- AlterTable
ALTER TABLE "InventoryBalance" ADD COLUMN "lotCode" VARCHAR(120) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "WmsTask" ADD COLUMN "lotCode" VARCHAR(120) NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX "InventoryBalance_warehouseId_binId_productId_key";

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_warehouseId_binId_productId_lotCode_key" ON "InventoryBalance"("warehouseId", "binId", "productId", "lotCode");
