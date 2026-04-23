-- SCRI R4: distinguish connector vs deterministic aiSummary

ALTER TABLE "ScriExternalEvent" ADD COLUMN "aiSummarySource" VARCHAR(32);
