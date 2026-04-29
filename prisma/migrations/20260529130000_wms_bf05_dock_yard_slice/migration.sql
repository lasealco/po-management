-- BF-05 — carrier transport metadata + yard milestone timestamps (non-TMS ops slice).

ALTER TABLE "WmsDockAppointment" ADD COLUMN "carrierName" VARCHAR(120);
ALTER TABLE "WmsDockAppointment" ADD COLUMN "carrierReference" VARCHAR(160);
ALTER TABLE "WmsDockAppointment" ADD COLUMN "trailerId" VARCHAR(80);
ALTER TABLE "WmsDockAppointment" ADD COLUMN "gateCheckedInAt" TIMESTAMP(3);
ALTER TABLE "WmsDockAppointment" ADD COLUMN "atDockAt" TIMESTAMP(3);
ALTER TABLE "WmsDockAppointment" ADD COLUMN "departedAt" TIMESTAMP(3);
