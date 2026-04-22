import { afterEach, describe, expect, it, vi } from "vitest";

const setMock = vi.fn();
const delMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      set: setMock,
      del: delMock,
    }),
  },
}));

describe("acquireApiHubCronSweepLock", () => {
  const prevUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    if (prevUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = prevUrl;
    if (prevToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = prevToken;
  });

  it("returns disabled handle when Upstash env is unset", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { acquireApiHubCronSweepLock } = await import("./apihub-cron-sweep-lock");
    const lock = await acquireApiHubCronSweepLock();
    expect(lock.ok).toBe(true);
    if (lock.ok) {
      expect(lock.mode).toBe("disabled");
      await lock.release();
    }
    expect(setMock).not.toHaveBeenCalled();
  });

  it("returns busy when Redis SET NX does not acquire", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    setMock.mockResolvedValue(null);
    const { acquireApiHubCronSweepLock } = await import("./apihub-cron-sweep-lock");
    const lock = await acquireApiHubCronSweepLock();
    expect(lock).toEqual({ ok: false, reason: "redis_lock_busy" });
  });

  it("returns redis handle and release calls DEL", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    setMock.mockResolvedValue("OK");
    const { acquireApiHubCronSweepLock } = await import("./apihub-cron-sweep-lock");
    const lock = await acquireApiHubCronSweepLock();
    expect(lock.ok).toBe(true);
    if (lock.ok && lock.mode === "redis") {
      await lock.release();
      expect(delMock).toHaveBeenCalledTimes(1);
    }
  });
});
