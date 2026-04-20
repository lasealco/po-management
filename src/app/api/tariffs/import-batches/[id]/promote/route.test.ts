import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const promoteApprovedStagingRowsToNewVersionMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/tariff/promote-staging-import", () => ({
  promoteApprovedStagingRowsToNewVersion: promoteApprovedStagingRowsToNewVersionMock,
}));

describe("POST /api/tariffs/import-batches/[id]/promote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns parity error body for invalid JSON payloads", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/tariffs/import-batches/batch-1/promote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "batch-1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON.", code: "BAD_INPUT" });
  });

  it("returns parity error body for malformed promote request shape", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/tariffs/import-batches/batch-1/promote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "batch-1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "contractHeaderId is required.", code: "BAD_INPUT" });
    expect(promoteApprovedStagingRowsToNewVersionMock).not.toHaveBeenCalled();
  });

  it("maps downstream TariffRepoError to status/body parity", async () => {
    const { POST } = await import("./route");
    const { TariffRepoError } = await import("@/lib/tariff/tariff-repo-error");

    promoteApprovedStagingRowsToNewVersionMock.mockRejectedValueOnce(
      new TariffRepoError("CONFLICT", "Import already promoted."),
    );

    const request = new Request("http://localhost/api/tariffs/import-batches/batch-1/promote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractHeaderId: "hdr-1" }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "batch-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Import already promoted.", code: "CONFLICT" });
  });
});
