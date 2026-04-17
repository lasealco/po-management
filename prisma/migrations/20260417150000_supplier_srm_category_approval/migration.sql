-- SRM: product vs logistics suppliers + procurement approval workflow.

CREATE TYPE "SrmSupplierCategory" AS ENUM ('product', 'logistics');

CREATE TYPE "SupplierApprovalStatus" AS ENUM ('pending_approval', 'approved', 'rejected');

ALTER TABLE "Supplier"
ADD COLUMN "srmCategory" "SrmSupplierCategory" NOT NULL DEFAULT 'product';

ALTER TABLE "Supplier"
ADD COLUMN "approvalStatus" "SupplierApprovalStatus" NOT NULL DEFAULT 'approved';

-- Treat existing forwarder-of-record suppliers as logistics (bookings reference them).
UPDATE "Supplier" s
SET "srmCategory" = 'logistics'
WHERE s.id IN (
  SELECT DISTINCT "forwarderSupplierId"
  FROM "ShipmentBooking"
  WHERE "forwarderSupplierId" IS NOT NULL
);
