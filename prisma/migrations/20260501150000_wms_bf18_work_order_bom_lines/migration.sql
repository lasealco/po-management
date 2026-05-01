-- BF-18 — Multi-line BOM snapshot on value-add work orders (planned vs consumed component qty).
CREATE TABLE "WmsWorkOrderBomLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "plannedQty" DECIMAL(14, 3) NOT NULL,
    "consumedQty" DECIMAL(14, 3) NOT NULL DEFAULT 0,
    "lineNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsWorkOrderBomLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsWorkOrderBomLine_workOrderId_lineNo_key" ON "WmsWorkOrderBomLine"("workOrderId", "lineNo");

CREATE INDEX "WmsWorkOrderBomLine_tenantId_workOrderId_idx" ON "WmsWorkOrderBomLine"("tenantId", "workOrderId");

CREATE INDEX "WmsWorkOrderBomLine_componentProductId_idx" ON "WmsWorkOrderBomLine"("componentProductId");

ALTER TABLE "WmsWorkOrderBomLine" ADD CONSTRAINT "WmsWorkOrderBomLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsWorkOrderBomLine" ADD CONSTRAINT "WmsWorkOrderBomLine_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WmsWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsWorkOrderBomLine" ADD CONSTRAINT "WmsWorkOrderBomLine_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
