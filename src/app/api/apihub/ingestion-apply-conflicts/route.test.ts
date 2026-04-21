import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const listApiHubApplyConflictsMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-apply-conflicts-repo", () => ({
  listApiHubApplyConflicts: listApiHubApplyConflictsMock,
}));

describe("GET /api/apihub/ingestion-apply-conflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns conflicts and nextCursor", async () => {
    listApiHubApplyConflictsMock.mockResolvedValue({
      items: [
        {
          id: "log-1",
          ingestionRunId: "run-1",
          actorUserId: "user-1",
          createdAt: "2026-04-22T12:00:00.000Z",
          resultCode: "APPLY_ALREADY_APPLIED",
          httpStatus: 409,
          dryRun: false,
          idempotencyKeyPresent: false,
          idempotentReplay: false,
          runStatusAtDecision: null,
          connectorId: null,
          requestId: "req-1",
        },
      ],
      nextCursor: "abc",
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-apply-conflicts?limit=10", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conf-1" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      conflicts: [
        {
          id: "log-1",
          ingestionRunId: "run-1",
          actorUserId: "user-1",
          createdAt: "2026-04-22T12:00:00.000Z",
          resultCode: "APPLY_ALREADY_APPLIED",
          httpStatus: 409,
          dryRun: false,
          idempotencyKeyPresent: false,
          idempotentReplay: false,
          runStatusAtDecision: null,
          connectorId: null,
          requestId: "req-1",
        },
      ],
      nextCursor: "abc",
    });
    expect(listApiHubApplyConflictsMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      limit: 10,
      cursor: null,
    });
  });
});
