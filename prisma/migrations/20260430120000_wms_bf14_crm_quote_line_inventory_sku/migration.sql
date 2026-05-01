-- BF-14 — CPQ quote line SKU for outbound explosion (`Product.sku` mapping).
ALTER TABLE "CrmQuoteLine" ADD COLUMN "inventorySku" VARCHAR(128);
