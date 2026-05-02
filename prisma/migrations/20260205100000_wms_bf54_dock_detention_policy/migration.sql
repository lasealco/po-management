-- BF-54 — tenant-scoped dock yard detention policy JSON (thresholds for alerts).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "wmsDockDetentionPolicyJson" JSONB;
