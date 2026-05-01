-- BF-19 — optional WGS84 pins for CRM accounts on Control Tower map (privacy: omit coords → no pin).

ALTER TABLE "CrmAccount" ADD COLUMN "mapLatitude" DECIMAL(10, 7);
ALTER TABLE "CrmAccount" ADD COLUMN "mapLongitude" DECIMAL(10, 7);
