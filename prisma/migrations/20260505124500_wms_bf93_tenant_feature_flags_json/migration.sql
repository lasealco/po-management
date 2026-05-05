-- BF-93 — tenant-scoped WMS feature-flag bundle JSON (ops toggles without redeploy).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "wmsFeatureFlagsJsonBf93" JSONB;
