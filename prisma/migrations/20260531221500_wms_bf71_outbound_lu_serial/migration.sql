-- BF-71: outbound logistics unit to inventory serial (aggregated closure manifest).

CREATE TABLE "WmsOutboundLuSerial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "outboundOrderId" TEXT NOT NULL,
    "logisticsUnitId" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsOutboundLuSerial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsOutboundLuSerial_outboundOrderId_serialId_key" ON "WmsOutboundLuSerial"("outboundOrderId", "serialId");
CREATE UNIQUE INDEX "WmsOutboundLuSerial_logisticsUnitId_serialId_key" ON "WmsOutboundLuSerial"("logisticsUnitId", "serialId");
CREATE INDEX "WmsOutboundLuSerial_tenantId_outboundOrderId_idx" ON "WmsOutboundLuSerial"("tenantId", "outboundOrderId");

ALTER TABLE "WmsOutboundLuSerial" ADD CONSTRAINT "WmsOutboundLuSerial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsOutboundLuSerial" ADD CONSTRAINT "WmsOutboundLuSerial_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "OutboundOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsOutboundLuSerial" ADD CONSTRAINT "WmsOutboundLuSerial_logisticsUnitId_fkey" FOREIGN KEY ("logisticsUnitId") REFERENCES "WmsOutboundLogisticsUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsOutboundLuSerial" ADD CONSTRAINT "WmsOutboundLuSerial_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "WmsInventorySerial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
