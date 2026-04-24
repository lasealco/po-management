-- Outbound ship-notice / ASN reference (Phase 2 / WMS GAP outbound ASN parity).
ALTER TABLE "OutboundOrder" ADD COLUMN "asnReference" TEXT;
