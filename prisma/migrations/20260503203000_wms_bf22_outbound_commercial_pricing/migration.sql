-- BF-22 — CPQ-style list vs contracted pricing on quote lines + outbound explosion snapshots.

ALTER TABLE "CrmQuoteLine" ADD COLUMN "listUnitPrice" DECIMAL(14,4),
ADD COLUMN "priceTierLabel" VARCHAR(64);

ALTER TABLE "OutboundOrderLine" ADD COLUMN "commercialUnitPrice" DECIMAL(14,4),
ADD COLUMN "commercialListUnitPrice" DECIMAL(14,4),
ADD COLUMN "commercialPriceTierLabel" VARCHAR(64),
ADD COLUMN "commercialExtendedAmount" DECIMAL(14,2);
