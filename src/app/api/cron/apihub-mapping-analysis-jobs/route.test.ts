import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sweepMock = vi.fn();
const reclaimIngestionMock = vi.fn();
const acquireLockMock = vi.fn();

vi.mock("@/lib/apihub/ingestion-run-stale-reclaim", () => ({
  reclaimStaleApiHubIngestionRuns: reclaimIngestionMock,
}));

vi.mock("@/lib/apihub/apihub-cron-sweep-lock", () => ({
  acquireApiHubCronSweepLock: acquireLockMock,
}));

vi.mock("@/lib/apihub/mapping-analysis-job-worker-sweep", () => ({
  runApiHubMappingAnalysisWorkerSweep: sweepMock,
  APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT: 20,
}));

describe("GET /api/cron/apihub-mapping-analysis-jobs", () => {
  const prevSecret = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = prevSecret;
    vi.clearAllMocks();
  });

  beforeEach(() => {
    acquireLockMock.mockResolvedValue({ ok: true, mode: "disabled", release: async () => {} });
  });

  it("returns 503 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/apihub-mapping-analysis-jobs"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["code", "error"]);
    expect(body.code).toBe("UNAVAILABLE");
    expect(body.error).toBe("CRON_SECRET is not configured.");
  });

  it("returns 401 when bearer does not match", async () => {
    process.env.CRON_SECRET = "secret-xyz";
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/cron/apihub-mapping-analysis-jobs", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["code", "error"]);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.error).toBe("Unauthorized");
    expect(sweepMock).not.toHaveBeenCalled();
    expect(reclaimIngestionMock).not.toHaveBeenCalled();
  });

  it("runs sweep when authorized", async () => {
    process.env.CRON_SECRET = "secret-xyz";
    reclaimIngestionMock.mockResolvedValue(1);
    sweepMock.mockResolvedValue({
      reclaimedStale: 0,
      claimedAndFinished: 2,
      attempts: 2,
      jobIdsTried: ["j1", "j2"],
    });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/cron/apihub-mapping-analysis-jobs?limit=3", {
        headers: { Authorization: "Bearer secret-xyz" },
      }),
    );
    expect(res.status).toBe(200);
    expect(reclaimIngestionMock).toHaveBeenCalledTimes(1);
    expect(sweepMock).toHaveBeenCalledWith(3);
    const body = (await res.json()) as {
      ok: boolean;
      reclaimedStaleIngestionRuns: number;
      reclaimedStale: number;
      claimedAndFinished: number;
      sweepLockMode?: string;
    };
    expect(body.ok).toBe(true);
    expect(body.reclaimedStaleIngestionRuns).toBe(1);
    expect(body.reclaimedStale).toBe(0);
    expect(body.claimedAndFinished).toBe(2);
    expect(body.sweepLockMode).toBe("disabled");
  });

  it("skips mapping sweep when redis lock is busy", async () => {
    process.env.CRON_SECRET = "secret-xyz";
    reclaimIngestionMock.mockResolvedValue(2);
    acquireLockMock.mockResolvedValue({ ok: false, reason: "redis_lock_busy" });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/cron/apihub-mapping-analysis-jobs", {
        headers: { Authorization: "Bearer secret-xyz" },
      }),
    );
    expect(res.status).toBe(200);
    expect(reclaimIngestionMock).toHaveBeenCalledTimes(1);
    expect(sweepMock).not.toHaveBeenCalled();
    const body = (await res.json()) as {
      ok: boolean;
      mappingSweepSkipped: string;
      reclaimedStaleIngestionRuns: number;
    };
    expect(body.ok).toBe(true);
    expect(body.mappingSweepSkipped).toBe("redis_lock_busy");
    expect(body.reclaimedStaleIngestionRuns).toBe(2);
  });
});
