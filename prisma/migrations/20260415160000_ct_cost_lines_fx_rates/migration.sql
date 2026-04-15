-- CreateTable
CREATE TABLE "CtFxRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baseCurrency" VARCHAR(3) NOT NULL,
    "quoteCurrency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CtFxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CtShipmentCostLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "amountMinor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CtShipmentCostLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CtFxRate_tenantId_baseCurrency_quoteCurrency_rateDate_key" ON "CtFxRate"("tenantId", "baseCurrency", "quoteCurrency", "rateDate");

-- CreateIndex
CREATE INDEX "CtFxRate_tenantId_baseCurrency_quoteCurrency_rateDate_idx" ON "CtFxRate"("tenantId", "baseCurrency", "quoteCurrency", "rateDate");

-- CreateIndex
CREATE INDEX "CtShipmentCostLine_tenantId_shipmentId_createdAt_idx" ON "CtShipmentCostLine"("tenantId", "shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "CtShipmentCostLine_shipmentId_currency_idx" ON "CtShipmentCostLine"("shipmentId", "currency");

-- AddForeignKey
ALTER TABLE "CtFxRate" ADD CONSTRAINT "CtFxRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtShipmentCostLine" ADD CONSTRAINT "CtShipmentCostLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtShipmentCostLine" ADD CONSTRAINT "CtShipmentCostLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtShipmentCostLine" ADD CONSTRAINT "CtShipmentCostLine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
