-- BF-67 — multi-parcel outbound manifest (JSON string[] of tracking ids).
ALTER TABLE "OutboundOrder" ADD COLUMN "manifestParcelIds" JSONB;
