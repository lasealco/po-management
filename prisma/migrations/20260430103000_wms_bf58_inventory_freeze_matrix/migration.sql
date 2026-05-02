-- BF-58 — structured inventory freeze metadata on balance rows
ALTER TABLE "InventoryBalance" ADD COLUMN "holdReasonCode" VARCHAR(64);
ALTER TABLE "InventoryBalance" ADD COLUMN "holdAppliedAt" TIMESTAMP(3);
ALTER TABLE "InventoryBalance" ADD COLUMN "holdAppliedById" TEXT;
ALTER TABLE "InventoryBalance" ADD COLUMN "holdReleaseGrant" VARCHAR(120);

CREATE INDEX "InventoryBalance_holdAppliedById_idx" ON "InventoryBalance"("holdAppliedById");

ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_holdAppliedById_fkey" FOREIGN KEY ("holdAppliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
