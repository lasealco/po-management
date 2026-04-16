-- Distinguish manual uploads vs TMS/ERP integrations (e.g. CargoWise); optional external document keys.

CREATE TYPE "CtShipmentDocumentSource" AS ENUM ('UPLOAD', 'INTEGRATION');

ALTER TABLE "CtShipmentDocument" ADD COLUMN "source" "CtShipmentDocumentSource" NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "CtShipmentDocument" ADD COLUMN "integrationProvider" TEXT;
ALTER TABLE "CtShipmentDocument" ADD COLUMN "externalRef" TEXT;

CREATE INDEX "CtShipmentDocument_shipmentId_source_idx" ON "CtShipmentDocument"("shipmentId", "source");
