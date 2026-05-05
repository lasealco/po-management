-- BF-79 — optional vendor/consignment ownership on inventory balance rows (VMI stub).

ALTER TABLE "InventoryBalance" ADD COLUMN IF NOT EXISTS "inventoryOwnershipSupplierIdBf79" TEXT;

DO $$
BEGIN
  ALTER TABLE "InventoryBalance"
    ADD CONSTRAINT "InventoryBalance_inventoryOwnershipSupplierIdBf79_fkey"
    FOREIGN KEY ("inventoryOwnershipSupplierIdBf79") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryBalance_tenantId_inventoryOwnershipSupplierIdBf79_idx"
  ON "InventoryBalance" ("tenantId", "inventoryOwnershipSupplierIdBf79");
