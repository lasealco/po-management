-- BF-17 TMS / carrier integration stub — external refs + webhook placeholder timestamps on dock appointments.
ALTER TABLE "WmsDockAppointment" ADD COLUMN "tmsLoadId" VARCHAR(120);
ALTER TABLE "WmsDockAppointment" ADD COLUMN "tmsCarrierBookingRef" VARCHAR(160);
ALTER TABLE "WmsDockAppointment" ADD COLUMN "tmsLastWebhookAt" TIMESTAMP(3);
