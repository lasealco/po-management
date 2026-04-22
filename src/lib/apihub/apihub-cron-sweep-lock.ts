import { Redis } from "@upstash/redis";

const LOCK_KEY = "apihub:cron:mapping-sweep:v1";

function readLockTtlSec(): number {
  const raw = process.env.APIHUB_CRON_SWEEP_LOCK_TTL_SEC;
  if (raw == null || String(raw).trim() === "") {
    return 480;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 480;
  }
  return Math.min(3600, Math.max(60, Math.floor(n)));
}

export type ApiHubCronSweepLockHandle =
  | { ok: true; mode: "disabled"; release: () => Promise<void> }
  | { ok: true; mode: "redis"; release: () => Promise<void> }
  | { ok: false; reason: "redis_lock_busy" };

/**
 * Optional **Upstash Redis** lock so only one mapping-analysis sweep runs at a time across regions / instances.
 * Ingestion stale reclaim runs **before** this lock in the cron handler (cheap + idempotent).
 *
 * Env: **`UPSTASH_REDIS_REST_URL`** + **`UPSTASH_REDIS_REST_TOKEN`** (standard Upstash REST).
 * TTL: **`APIHUB_CRON_SWEEP_LOCK_TTL_SEC`** (default **480**, clamped **60–3600**). If the worker crashes, the lock expires.
 *
 * When Redis env is unset, returns **`mode: "disabled"`** (no-op release) so existing deployments behave unchanged.
 */
export async function acquireApiHubCronSweepLock(): Promise<ApiHubCronSweepLockHandle> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return { ok: true, mode: "disabled", release: async () => {} };
  }

  const redis = Redis.fromEnv();
  const ttl = readLockTtlSec();
  const acquired = await redis.set(LOCK_KEY, "1", { nx: true, ex: ttl });
  if (!acquired) {
    return { ok: false, reason: "redis_lock_busy" };
  }

  return {
    ok: true,
    mode: "redis",
    release: async () => {
      await redis.del(LOCK_KEY);
    },
  };
}
