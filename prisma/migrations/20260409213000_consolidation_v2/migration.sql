-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('CFS', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "LoadPlanStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'CFS',
    "addressLine1" TEXT,
    "city" TEXT,
    "region" TEXT,
    "countryCode" VARCHAR(2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "plannedEta" TIMESTAMP(3),
    "status" "LoadPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadPlanShipment" (
    "id" TEXT NOT NULL,
    "loadPlanId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoadPlanShipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "Warehouse"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Warehouse_tenantId_idx" ON "Warehouse"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LoadPlan_tenantId_reference_key" ON "LoadPlan"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "LoadPlan_tenantId_createdAt_idx" ON "LoadPlan"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "LoadPlan_warehouseId_idx" ON "LoadPlan"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "LoadPlanShipment_shipmentId_key" ON "LoadPlanShipment"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LoadPlanShipment_loadPlanId_shipmentId_key" ON "LoadPlanShipment"("loadPlanId", "shipmentId");

-- CreateIndex
CREATE INDEX "LoadPlanShipment_loadPlanId_idx" ON "LoadPlanShipment"("loadPlanId");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadPlan" ADD CONSTRAINT "LoadPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadPlan" ADD CONSTRAINT "LoadPlan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadPlan" ADD CONSTRAINT "LoadPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadPlanShipment" ADD CONSTRAINT "LoadPlanShipment_loadPlanId_fkey" FOREIGN KEY ("loadPlanId") REFERENCES "LoadPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadPlanShipment" ADD CONSTRAINT "LoadPlanShipment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
