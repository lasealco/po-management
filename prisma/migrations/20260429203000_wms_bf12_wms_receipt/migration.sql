-- BF-12 — `WmsReceipt` / `WmsReceiptLine` (Receiving Option B dock session); coexists with Option A + BF-01 line truth on `ShipmentItem`.

CREATE TYPE "WmsReceiptStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "WmsReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "WmsReceiptStatus" NOT NULL DEFAULT 'OPEN',
    "dockNote" VARCHAR(2000),
    "dockReceivedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WmsReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "shipmentItemId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(14,3) NOT NULL,
    "wmsVarianceDisposition" "WmsShipmentItemVarianceDisposition" NOT NULL DEFAULT 'UNSET',
    "wmsVarianceNote" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WmsReceipt_tenantId_shipmentId_idx" ON "WmsReceipt"("tenantId", "shipmentId");
CREATE INDEX "WmsReceipt_tenantId_status_idx" ON "WmsReceipt"("tenantId", "status");
CREATE INDEX "WmsReceiptLine_shipmentItemId_idx" ON "WmsReceiptLine"("shipmentItemId");
CREATE UNIQUE INDEX "WmsReceiptLine_receiptId_shipmentItemId_key" ON "WmsReceiptLine"("receiptId", "shipmentItemId");

ALTER TABLE "WmsReceipt" ADD CONSTRAINT "WmsReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsReceipt" ADD CONSTRAINT "WmsReceipt_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsReceipt" ADD CONSTRAINT "WmsReceipt_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsReceipt" ADD CONSTRAINT "WmsReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WmsReceiptLine" ADD CONSTRAINT "WmsReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "WmsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsReceiptLine" ADD CONSTRAINT "WmsReceiptLine_shipmentItemId_fkey" FOREIGN KEY ("shipmentItemId") REFERENCES "ShipmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
