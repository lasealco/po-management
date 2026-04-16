-- Per-container stuffing: which shipment line quantities sit in which equipment unit.

CREATE TABLE "CtContainerCargoLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "shipmentItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CtContainerCargoLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CtContainerCargoLine_containerId_shipmentItemId_key" ON "CtContainerCargoLine"("containerId", "shipmentItemId");
CREATE INDEX "CtContainerCargoLine_tenantId_containerId_idx" ON "CtContainerCargoLine"("tenantId", "containerId");
CREATE INDEX "CtContainerCargoLine_shipmentItemId_idx" ON "CtContainerCargoLine"("shipmentItemId");

ALTER TABLE "CtContainerCargoLine" ADD CONSTRAINT "CtContainerCargoLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtContainerCargoLine" ADD CONSTRAINT "CtContainerCargoLine_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "CtShipmentContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtContainerCargoLine" ADD CONSTRAINT "CtContainerCargoLine_shipmentItemId_fkey" FOREIGN KEY ("shipmentItemId") REFERENCES "ShipmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
