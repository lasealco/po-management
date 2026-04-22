import { afterEach, describe, expect, it, vi } from "vitest";

const sweepMock = vi.fn();

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

  it("returns 503 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/cron/apihub-mapping-analysis-jobs"));
    expect(res.status).toBe(503);
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
    expect(sweepMock).not.toHaveBeenCalled();
  });

  it("runs sweep when authorized", async () => {
    process.env.CRON_SECRET = "secret-xyz";
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
    expect(sweepMock).toHaveBeenCalledWith(3);
    const body = (await res.json()) as { ok: boolean; reclaimedStale: number; claimedAndFinished: number };
    expect(body.ok).toBe(true);
    expect(body.reclaimedStale).toBe(0);
    expect(body.claimedAndFinished).toBe(2);
  });
});
