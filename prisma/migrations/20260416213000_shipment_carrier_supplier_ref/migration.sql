-- Normalize Shipment header carrier to Supplier master reference.

ALTER TABLE "Shipment"
ADD COLUMN "carrierSupplierId" TEXT;

CREATE INDEX "Shipment_carrierSupplierId_idx" ON "Shipment"("carrierSupplierId");

ALTER TABLE "Shipment"
ADD CONSTRAINT "Shipment_carrierSupplierId_fkey"
FOREIGN KEY ("carrierSupplierId") REFERENCES "Supplier"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
