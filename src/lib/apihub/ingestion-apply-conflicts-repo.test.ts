import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: h.$queryRaw,
  },
}));

import { listApiHubApplyConflicts } from "./ingestion-apply-conflicts-repo";

describe("listApiHubApplyConflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns DTOs and nextCursor when more rows exist", async () => {
    const t1 = new Date("2026-04-22T12:00:01.000Z");
    const t2 = new Date("2026-04-22T12:00:00.000Z");
    h.$queryRaw.mockResolvedValue([
      {
        id: "a1",
        ingestionRunId: "run-1",
        actorUserId: "u1",
        createdAt: t1,
        metadata: {
          resultCode: "APPLY_ALREADY_APPLIED",
          httpStatus: 409,
          requestId: "req-1",
          dryRun: false,
          idempotencyKeyPresent: false,
          outcome: "client_error",
          verb: "apply",
        },
      },
      {
        id: "a0",
        ingestionRunId: "run-2",
        actorUserId: "u1",
        createdAt: t2,
        metadata: {
          resultCode: "APPLY_RUN_NOT_SUCCEEDED",
          httpStatus: 409,
          requestId: "req-0",
          runStatusAtDecision: "queued",
          connectorId: null,
        },
      },
    ]);
    const out = await listApiHubApplyConflicts({ tenantId: "t1", limit: 1, cursor: null });
    expect(out.items).toHaveLength(1);
    expect(out.items[0]?.resultCode).toBe("APPLY_ALREADY_APPLIED");
    expect(out.nextCursor).toBeTruthy();
  });
});
