-- Normalize Control Tower leg carrier and cost vendor to supplier master references.

ALTER TABLE "CtShipmentLeg"
ADD COLUMN "carrierSupplierId" TEXT;

ALTER TABLE "CtShipmentCostLine"
ADD COLUMN "vendorSupplierId" TEXT;

CREATE INDEX "CtShipmentLeg_carrierSupplierId_idx" ON "CtShipmentLeg"("carrierSupplierId");
CREATE INDEX "CtShipmentCostLine_vendorSupplierId_idx" ON "CtShipmentCostLine"("vendorSupplierId");

ALTER TABLE "CtShipmentLeg"
ADD CONSTRAINT "CtShipmentLeg_carrierSupplierId_fkey"
FOREIGN KEY ("carrierSupplierId") REFERENCES "Supplier"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CtShipmentCostLine"
ADD CONSTRAINT "CtShipmentCostLine_vendorSupplierId_fkey"
FOREIGN KEY ("vendorSupplierId") REFERENCES "Supplier"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
