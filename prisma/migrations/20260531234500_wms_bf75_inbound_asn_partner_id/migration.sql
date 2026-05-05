-- BF-75 — optional partner identifier on inbound ASN pre-advise rows (normalize webhook metadata).

ALTER TABLE "WmsInboundAsnAdvise" ADD COLUMN "asnPartnerId" VARCHAR(128);

CREATE INDEX "WmsInboundAsnAdvise_tenantId_asnPartnerId_idx" ON "WmsInboundAsnAdvise"("tenantId", "asnPartnerId");
