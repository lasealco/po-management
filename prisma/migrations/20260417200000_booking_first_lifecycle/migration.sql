-- Booking-first lifecycle: shipment pre-execution states + booking sent/SLA + forwarder SLA hours on supplier.

-- ShipmentStatus: new values (append order for PostgreSQL enums)
ALTER TYPE "ShipmentStatus" ADD VALUE 'BOOKING_DRAFT';
ALTER TYPE "ShipmentStatus" ADD VALUE 'BOOKING_SUBMITTED';

-- ShipmentBookingStatus
ALTER TYPE "ShipmentBookingStatus" ADD VALUE 'SENT';

-- ShipmentBooking SLA timestamps
ALTER TABLE "ShipmentBooking" ADD COLUMN "bookingSentAt" TIMESTAMP(3);
ALTER TABLE "ShipmentBooking" ADD COLUMN "bookingConfirmSlaDueAt" TIMESTAMP(3);

-- Supplier: optional per-forwarder SLA (hours)
ALTER TABLE "Supplier" ADD COLUMN "bookingConfirmationSlaHours" INTEGER;

-- Prefer booking-draft as default for new shipments (explicit status still set in app code).
ALTER TABLE "Shipment" ALTER COLUMN "status" SET DEFAULT 'BOOKING_DRAFT';
