-- BF-43 — outbound logistics units (SSCC / LPN hierarchy + pack-scan multiset substitution).

CREATE TYPE "WmsOutboundLogisticsUnitKind" AS ENUM ('PALLET', 'CASE', 'INNER_PACK', 'EACH', 'UNKNOWN');

CREATE TABLE "WmsOutboundLogisticsUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "outboundOrderId" TEXT NOT NULL,
    "scanCode" TEXT NOT NULL,
    "kind" "WmsOutboundLogisticsUnitKind" NOT NULL DEFAULT 'UNKNOWN',
    "parentUnitId" TEXT,
    "outboundOrderLineId" TEXT,
    "containedQty" DECIMAL(14,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsOutboundLogisticsUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsOutboundLogisticsUnit_tenantId_outboundOrderId_scanCode_key" ON "WmsOutboundLogisticsUnit"("tenantId", "outboundOrderId", "scanCode");

CREATE INDEX "WmsOutboundLogisticsUnit_tenantId_outboundOrderId_idx" ON "WmsOutboundLogisticsUnit"("tenantId", "outboundOrderId");

CREATE INDEX "WmsOutboundLogisticsUnit_tenantId_outboundOrderLineId_idx" ON "WmsOutboundLogisticsUnit"("tenantId", "outboundOrderLineId");

ALTER TABLE "WmsOutboundLogisticsUnit" ADD CONSTRAINT "WmsOutboundLogisticsUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsOutboundLogisticsUnit" ADD CONSTRAINT "WmsOutboundLogisticsUnit_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "OutboundOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsOutboundLogisticsUnit" ADD CONSTRAINT "WmsOutboundLogisticsUnit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "WmsOutboundLogisticsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WmsOutboundLogisticsUnit" ADD CONSTRAINT "WmsOutboundLogisticsUnit_outboundOrderLineId_fkey" FOREIGN KEY ("outboundOrderLineId") REFERENCES "OutboundOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
