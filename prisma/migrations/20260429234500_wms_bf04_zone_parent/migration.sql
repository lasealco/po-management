-- BF-04 — optional parent zone link for multi-level functional topology (same warehouse).
ALTER TABLE "WarehouseZone" ADD COLUMN "parentZoneId" TEXT;

CREATE INDEX "WarehouseZone_parentZoneId_idx" ON "WarehouseZone"("parentZoneId");

ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_parentZoneId_fkey" FOREIGN KEY ("parentZoneId") REFERENCES "WarehouseZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
