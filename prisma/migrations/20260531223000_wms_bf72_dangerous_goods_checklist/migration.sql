-- BF-72: outbound dangerous goods checklist JSON (operator attestation).

ALTER TABLE "OutboundOrder" ADD COLUMN "wmsDangerousGoodsChecklistJson" JSONB;
