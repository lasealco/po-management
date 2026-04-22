import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: h.$queryRaw,
  },
}));

import { getApiHubIngestionAlertsSummary } from "./ingestion-alerts-summary-repo";

describe("getApiHubIngestionAlertsSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps apply audit rows to alerts with severity counts", async () => {
    h.$queryRaw.mockResolvedValue([
      {
        id: "log-1",
        ingestionRunId: "run-1",
        action: "apihub.ingestion_run.apply",
        createdAt: new Date("2026-04-22T12:00:00.000Z"),
        metadata: {
          outcome: "client_error",
          resultCode: "APPLY_ALREADY_APPLIED",
          httpStatus: 409,
          requestId: "req-1",
        },
      },
      {
        id: "log-2",
        ingestionRunId: "run-2",
        action: "apihub.ingestion_run.apply",
        createdAt: new Date("2026-04-22T11:00:00.000Z"),
        metadata: {
          outcome: "client_error",
          resultCode: "APPLY_IDEMPOTENCY_KEY_CONFLICT",
          httpStatus: 409,
        },
      },
    ]);
    const out = await getApiHubIngestionAlertsSummary({ tenantId: "t1", limit: 10 });
    expect(out.counts).toEqual({ error: 1, warn: 1, info: 0 });
    expect(out.alerts).toHaveLength(2);
    expect(out.alerts[0]?.severity).toBe("error");
    expect(out.alerts[1]?.severity).toBe("warn");
    expect(out.alerts[1]?.resultCode).toBe("APPLY_IDEMPOTENCY_KEY_CONFLICT");
  });

  it("still maps legacy short apply/retry action values if present", async () => {
    h.$queryRaw.mockResolvedValue([
      {
        id: "log-legacy",
        ingestionRunId: "run-legacy",
        action: "apply",
        createdAt: new Date("2026-04-22T09:00:00.000Z"),
        metadata: {
          outcome: "client_error",
          resultCode: "RUN_NOT_FOUND",
          httpStatus: 404,
        },
      },
    ]);
    const out = await getApiHubIngestionAlertsSummary({ tenantId: "t1", limit: 5 });
    expect(out.alerts[0]?.source).toBe("apply");
    expect(out.alerts[0]?.title).toContain("not found");
  });

  it("maps retry failures", async () => {
    h.$queryRaw.mockResolvedValue([
      {
        id: "log-r",
        ingestionRunId: "run-x",
        action: "apihub.ingestion_run.retry",
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        metadata: {
          outcome: "client_error",
          resultCode: "RETRY_REQUIRES_FAILED",
          httpStatus: 409,
        },
      },
    ]);
    const out = await getApiHubIngestionAlertsSummary({ tenantId: "t1", limit: 5 });
    expect(out.alerts[0]?.source).toBe("retry");
    expect(out.alerts[0]?.title).toContain("Retry blocked");
  });

  describe("tenant binding in raw SQL (Slice 61)", () => {
    it("binds tenantId in Prisma.sql values", async () => {
      h.$queryRaw.mockResolvedValue([]);
      await getApiHubIngestionAlertsSummary({ tenantId: "tenant-alerts-zz", limit: 8 });
      const sql = h.$queryRaw.mock.calls[0]![0] as { values: unknown[] };
      expect(sql.values).toContain("tenant-alerts-zz");
    });
  });
});
