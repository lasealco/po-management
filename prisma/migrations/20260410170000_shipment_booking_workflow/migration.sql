-- Extend shipment status lifecycle for booking + transit flow.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ShipmentStatus' AND e.enumlabel = 'VALIDATED'
  ) THEN
    ALTER TYPE "ShipmentStatus" ADD VALUE 'VALIDATED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ShipmentStatus' AND e.enumlabel = 'BOOKED'
  ) THEN
    ALTER TYPE "ShipmentStatus" ADD VALUE 'BOOKED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ShipmentStatus' AND e.enumlabel = 'IN_TRANSIT'
  ) THEN
    ALTER TYPE "ShipmentStatus" ADD VALUE 'IN_TRANSIT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ShipmentStatus' AND e.enumlabel = 'DELIVERED'
  ) THEN
    ALTER TYPE "ShipmentStatus" ADD VALUE 'DELIVERED';
  END IF;
END$$;

CREATE TYPE "ShipmentBookingStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "ShipmentMilestoneCode" AS ENUM (
  'ASN_SUBMITTED',
  'ASN_VALIDATED',
  'BOOKING_CONFIRMED',
  'DEPARTED',
  'ARRIVED',
  'DELIVERED',
  'RECEIVED'
);
CREATE TYPE "ShipmentMilestoneSource" AS ENUM ('SUPPLIER', 'INTERNAL', 'FORWARDER', 'SYSTEM');

CREATE TABLE "ShipmentBooking" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "status" "ShipmentBookingStatus" NOT NULL DEFAULT 'DRAFT',
  "bookingNo" TEXT,
  "serviceLevel" TEXT,
  "forwarderSupplierId" TEXT,
  "forwarderOfficeId" TEXT,
  "forwarderContactId" TEXT,
  "mode" "TransportMode",
  "originCode" TEXT,
  "destinationCode" TEXT,
  "etd" TIMESTAMP(3),
  "eta" TIMESTAMP(3),
  "latestEta" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShipmentBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentMilestone" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "code" "ShipmentMilestoneCode" NOT NULL,
  "source" "ShipmentMilestoneSource" NOT NULL DEFAULT 'INTERNAL',
  "plannedAt" TIMESTAMP(3),
  "actualAt" TIMESTAMP(3),
  "note" TEXT,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShipmentBooking_shipmentId_key" ON "ShipmentBooking"("shipmentId");
CREATE INDEX "ShipmentBooking_status_idx" ON "ShipmentBooking"("status");
CREATE INDEX "ShipmentBooking_forwarderSupplierId_idx" ON "ShipmentBooking"("forwarderSupplierId");
CREATE INDEX "ShipmentMilestone_shipmentId_createdAt_idx" ON "ShipmentMilestone"("shipmentId", "createdAt");
CREATE INDEX "ShipmentMilestone_code_idx" ON "ShipmentMilestone"("code");

ALTER TABLE "ShipmentBooking"
  ADD CONSTRAINT "ShipmentBooking_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentBooking"
  ADD CONSTRAINT "ShipmentBooking_forwarderSupplierId_fkey"
  FOREIGN KEY ("forwarderSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentBooking"
  ADD CONSTRAINT "ShipmentBooking_forwarderOfficeId_fkey"
  FOREIGN KEY ("forwarderOfficeId") REFERENCES "SupplierOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentBooking"
  ADD CONSTRAINT "ShipmentBooking_forwarderContactId_fkey"
  FOREIGN KEY ("forwarderContactId") REFERENCES "SupplierContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentBooking"
  ADD CONSTRAINT "ShipmentBooking_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentBooking"
  ADD CONSTRAINT "ShipmentBooking_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShipmentMilestone"
  ADD CONSTRAINT "ShipmentMilestone_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentMilestone"
  ADD CONSTRAINT "ShipmentMilestone_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
