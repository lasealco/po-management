-- CreateEnum
CREATE TYPE "WmsWorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "WmsWorkOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "workOrderNo" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "WmsWorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsWorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsWorkOrder_tenantId_workOrderNo_key" ON "WmsWorkOrder"("tenantId", "workOrderNo");
CREATE INDEX "WmsWorkOrder_tenantId_warehouseId_status_idx" ON "WmsWorkOrder"("tenantId", "warehouseId", "status");

-- AddForeignKey
ALTER TABLE "WmsWorkOrder" ADD CONSTRAINT "WmsWorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsWorkOrder" ADD CONSTRAINT "WmsWorkOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsWorkOrder" ADD CONSTRAINT "WmsWorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "WmsTaskType" ADD VALUE 'VALUE_ADD';
