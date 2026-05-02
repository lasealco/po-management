-- BF-59 — idempotent inbound ASN pre-advise JSON stub
CREATE TABLE "WmsInboundAsnAdvise" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalAsnId" VARCHAR(256) NOT NULL,
    "warehouseId" TEXT,
    "purchaseOrderId" TEXT,
    "shipmentId" TEXT,
    "asnReference" VARCHAR(256),
    "expectedReceiveAt" TIMESTAMP(3),
    "linesJson" JSONB NOT NULL,
    "rawPayloadJson" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsInboundAsnAdvise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsInboundAsnAdvise_tenantId_externalAsnId_key" ON "WmsInboundAsnAdvise"("tenantId", "externalAsnId");

CREATE INDEX "WmsInboundAsnAdvise_tenantId_createdAt_idx" ON "WmsInboundAsnAdvise"("tenantId", "createdAt");

CREATE INDEX "WmsInboundAsnAdvise_shipmentId_idx" ON "WmsInboundAsnAdvise"("shipmentId");

CREATE INDEX "WmsInboundAsnAdvise_purchaseOrderId_idx" ON "WmsInboundAsnAdvise"("purchaseOrderId");

ALTER TABLE "WmsInboundAsnAdvise" ADD CONSTRAINT "WmsInboundAsnAdvise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsInboundAsnAdvise" ADD CONSTRAINT "WmsInboundAsnAdvise_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WmsInboundAsnAdvise" ADD CONSTRAINT "WmsInboundAsnAdvise_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WmsInboundAsnAdvise" ADD CONSTRAINT "WmsInboundAsnAdvise_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WmsInboundAsnAdvise" ADD CONSTRAINT "WmsInboundAsnAdvise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
