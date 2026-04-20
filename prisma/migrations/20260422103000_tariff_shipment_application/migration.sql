-- Links shipments to tariff contract versions (operational quoting / audit trail).

CREATE TABLE "tariff_shipment_applications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "polCode" VARCHAR(16),
    "podCode" VARCHAR(16),
    "equipmentType" VARCHAR(32),
    "appliedNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_shipment_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tariff_shipment_applications_shipmentId_contractVersionId_key" ON "tariff_shipment_applications"("shipmentId", "contractVersionId");
CREATE INDEX "tariff_shipment_applications_tenantId_shipmentId_idx" ON "tariff_shipment_applications"("tenantId", "shipmentId");
CREATE INDEX "tariff_shipment_applications_contractVersionId_idx" ON "tariff_shipment_applications"("contractVersionId");

ALTER TABLE "tariff_shipment_applications" ADD CONSTRAINT "tariff_shipment_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tariff_shipment_applications" ADD CONSTRAINT "tariff_shipment_applications_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tariff_shipment_applications" ADD CONSTRAINT "tariff_shipment_applications_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "contract_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tariff_shipment_applications" ADD CONSTRAINT "tariff_shipment_applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
