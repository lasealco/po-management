import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const userHasGlobalGrantMock = vi.fn();
const discardMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({
  getActorUserId: getActorUserIdMock,
  userHasGlobalGrant: userHasGlobalGrantMock,
}));
vi.mock("@/lib/apihub/staging-batches-repo", () => ({
  discardApiHubStagingBatch: discardMock,
}));

describe("POST /api/apihub/staging-batches/[batchId]/discard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    userHasGlobalGrantMock.mockResolvedValue(true);
  });

  it("returns 200 when discard succeeds", async () => {
    discardMock.mockResolvedValue({ ok: true });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/apihub/staging-batches/b1/discard", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "st-dis-1" },
      }),
      { params: Promise.resolve({ batchId: "b1" }) },
    );
    expect(res.status).toBe(200);
    expect(discardMock).toHaveBeenCalledWith({ tenantId: "tenant-1", batchId: "b1" });
  });

  it("returns 409 when batch already applied", async () => {
    discardMock.mockResolvedValue({ ok: false, reason: "already_applied" });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/apihub/staging-batches/b1/discard", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "st-dis-2" },
      }),
      { params: Promise.resolve({ batchId: "b1" }) },
    );
    expect(res.status).toBe(409);
  });
});
