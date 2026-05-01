-- BF-38 — optional door assignment + trailer checklist JSON on dock appointments
ALTER TABLE "WmsDockAppointment" ADD COLUMN "doorCode" VARCHAR(64);
ALTER TABLE "WmsDockAppointment" ADD COLUMN "trailerChecklistJson" JSONB;
