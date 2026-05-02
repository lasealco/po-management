-- BF-61 — weekly demand forecast stub per warehouse × SKU (replenishment priority boost).
CREATE TABLE "WmsDemandForecastStub" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "forecastQty" DECIMAL(14,3) NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "WmsDemandForecastStub_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsDemandForecastStub_tenantId_warehouseId_productId_weekStart_key" ON "WmsDemandForecastStub"("tenantId", "warehouseId", "productId", "weekStart");

CREATE INDEX "WmsDemandForecastStub_tenantId_weekStart_idx" ON "WmsDemandForecastStub"("tenantId", "weekStart");

ALTER TABLE "WmsDemandForecastStub" ADD CONSTRAINT "WmsDemandForecastStub_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsDemandForecastStub" ADD CONSTRAINT "WmsDemandForecastStub_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsDemandForecastStub" ADD CONSTRAINT "WmsDemandForecastStub_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsDemandForecastStub" ADD CONSTRAINT "WmsDemandForecastStub_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
