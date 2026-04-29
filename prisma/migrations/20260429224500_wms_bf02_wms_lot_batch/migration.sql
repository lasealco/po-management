-- BF-02: tenant-scoped lot/batch master (attributes keyed by product + lotCode; balances keep lotCode buckets).
CREATE TABLE "WmsLotBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotCode" VARCHAR(120) NOT NULL,
    "expiryDate" DATE,
    "countryOfOrigin" VARCHAR(80),
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsLotBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsLotBatch_tenantId_productId_lotCode_key" ON "WmsLotBatch"("tenantId", "productId", "lotCode");
CREATE INDEX "WmsLotBatch_tenantId_idx" ON "WmsLotBatch"("tenantId");
CREATE INDEX "WmsLotBatch_productId_idx" ON "WmsLotBatch"("productId");

ALTER TABLE "WmsLotBatch" ADD CONSTRAINT "WmsLotBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsLotBatch" ADD CONSTRAINT "WmsLotBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
