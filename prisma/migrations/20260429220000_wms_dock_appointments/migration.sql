-- CreateEnum
CREATE TYPE "WmsDockAppointmentDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WmsDockAppointmentStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "WmsDockAppointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "dockCode" VARCHAR(64) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "direction" "WmsDockAppointmentDirection" NOT NULL,
    "shipmentId" TEXT,
    "outboundOrderId" TEXT,
    "status" "WmsDockAppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" VARCHAR(500),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsDockAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WmsDockAppointment_tenantId_warehouseId_windowStart_idx" ON "WmsDockAppointment"("tenantId", "warehouseId", "windowStart");

-- CreateIndex
CREATE INDEX "WmsDockAppointment_tenantId_warehouseId_dockCode_idx" ON "WmsDockAppointment"("tenantId", "warehouseId", "dockCode");

-- CreateIndex
CREATE INDEX "WmsDockAppointment_shipmentId_idx" ON "WmsDockAppointment"("shipmentId");

-- CreateIndex
CREATE INDEX "WmsDockAppointment_outboundOrderId_idx" ON "WmsDockAppointment"("outboundOrderId");

-- AddForeignKey
ALTER TABLE "WmsDockAppointment" ADD CONSTRAINT "WmsDockAppointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsDockAppointment" ADD CONSTRAINT "WmsDockAppointment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsDockAppointment" ADD CONSTRAINT "WmsDockAppointment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsDockAppointment" ADD CONSTRAINT "WmsDockAppointment_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "OutboundOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WmsDockAppointment" ADD CONSTRAINT "WmsDockAppointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
