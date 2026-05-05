-- BF-87 — optional commercial terms snapshot on outbound for DESADV / ASN export
ALTER TABLE "OutboundOrder" ADD COLUMN "wmsCommercialTermsJsonBf87" JSONB;
