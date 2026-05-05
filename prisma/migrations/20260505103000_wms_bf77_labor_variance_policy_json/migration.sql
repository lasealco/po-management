-- BF-77 — optional tenant labor variance thresholds (`Tenant.wmsLaborVariancePolicyJson`).

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "wmsLaborVariancePolicyJson" JSONB;
