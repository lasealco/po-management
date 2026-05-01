-- BF-31 — GRN on closed dock receipts + optional ASN qty tolerance % on inbound shipments

ALTER TABLE "Shipment" ADD COLUMN "asnQtyTolerancePct" DECIMAL(5, 2);

ALTER TABLE "WmsReceipt" ADD COLUMN "grnReference" VARCHAR(128);
