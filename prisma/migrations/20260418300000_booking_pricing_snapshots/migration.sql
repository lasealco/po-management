-- Immutable booking pricing snapshots (contract or RFQ basis)

CREATE TYPE "PricingSnapshotSourceType" AS ENUM ('TARIFF_CONTRACT_VERSION', 'QUOTE_RESPONSE');

CREATE TABLE "booking_pricing_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentBookingId" TEXT,
    "sourceType" "PricingSnapshotSourceType" NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceSummary" TEXT,
    "currency" VARCHAR(3) NOT NULL,
    "totalEstimatedCost" DECIMAL(18,4) NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "freeTimeBasisJson" JSONB NOT NULL,
    "totalDerivation" TEXT NOT NULL DEFAULT 'SUM_RATE_AND_CHARGE_AMOUNTS',
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "commercialJson" JSONB,
    "basisSide" VARCHAR(16),

    CONSTRAINT "booking_pricing_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_pricing_snapshots_tenantId_idx" ON "booking_pricing_snapshots"("tenantId");
CREATE INDEX "booking_pricing_snapshots_tenantId_frozenAt_idx" ON "booking_pricing_snapshots"("tenantId", "frozenAt");
CREATE INDEX "booking_pricing_snapshots_shipmentBookingId_idx" ON "booking_pricing_snapshots"("shipmentBookingId");
CREATE INDEX "booking_pricing_snapshots_sourceType_sourceRecordId_idx" ON "booking_pricing_snapshots"("sourceType", "sourceRecordId");

ALTER TABLE "booking_pricing_snapshots" ADD CONSTRAINT "booking_pricing_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_pricing_snapshots" ADD CONSTRAINT "booking_pricing_snapshots_shipmentBookingId_fkey" FOREIGN KEY ("shipmentBookingId") REFERENCES "ShipmentBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_pricing_snapshots" ADD CONSTRAINT "booking_pricing_snapshots_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
