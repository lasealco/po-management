-- BF-39 — persist carrier label purchase tracking on outbound orders
ALTER TABLE "OutboundOrder" ADD COLUMN "carrierTrackingNo" VARCHAR(128),
ADD COLUMN "carrierLabelAdapterId" VARCHAR(64),
ADD COLUMN "carrierLabelPurchasedAt" TIMESTAMP(3);
