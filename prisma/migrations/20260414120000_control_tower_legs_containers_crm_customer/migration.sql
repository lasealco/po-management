-- Control Tower: shipment legs & containers; CRM customer scope on User + Shipment.

ALTER TABLE "Shipment" ADD COLUMN "customerCrmAccountId" TEXT;
CREATE INDEX "Shipment_customerCrmAccountId_idx" ON "Shipment"("customerCrmAccountId");
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_customerCrmAccountId_fkey" FOREIGN KEY ("customerCrmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "customerCrmAccountId" TEXT;
CREATE INDEX "User_customerCrmAccountId_idx" ON "User"("customerCrmAccountId");
ALTER TABLE "User" ADD CONSTRAINT "User_customerCrmAccountId_fkey" FOREIGN KEY ("customerCrmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CtShipmentLeg" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "legNo" INTEGER NOT NULL DEFAULT 1,
    "originCode" TEXT,
    "destinationCode" TEXT,
    "carrier" TEXT,
    "transportMode" "TransportMode",
    "plannedEtd" TIMESTAMP(3),
    "plannedEta" TIMESTAMP(3),
    "actualAtd" TIMESTAMP(3),
    "actualAta" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CtShipmentLeg_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CtShipmentLeg_shipmentId_legNo_key" ON "CtShipmentLeg"("shipmentId", "legNo");
CREATE INDEX "CtShipmentLeg_tenantId_shipmentId_idx" ON "CtShipmentLeg"("tenantId", "shipmentId");
ALTER TABLE "CtShipmentLeg" ADD CONSTRAINT "CtShipmentLeg_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentLeg" ADD CONSTRAINT "CtShipmentLeg_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CtShipmentContainer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "legId" TEXT,
    "containerNumber" TEXT NOT NULL,
    "containerType" TEXT,
    "seal" TEXT,
    "status" TEXT,
    "gateInAt" TIMESTAMP(3),
    "gateOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CtShipmentContainer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CtShipmentContainer_shipmentId_idx" ON "CtShipmentContainer"("shipmentId");
CREATE INDEX "CtShipmentContainer_tenantId_containerNumber_idx" ON "CtShipmentContainer"("tenantId", "containerNumber");
CREATE INDEX "CtShipmentContainer_legId_idx" ON "CtShipmentContainer"("legId");
ALTER TABLE "CtShipmentContainer" ADD CONSTRAINT "CtShipmentContainer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentContainer" ADD CONSTRAINT "CtShipmentContainer_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CtShipmentContainer" ADD CONSTRAINT "CtShipmentContainer_legId_fkey" FOREIGN KEY ("legId") REFERENCES "CtShipmentLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
