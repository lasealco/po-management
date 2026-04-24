import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getControlTowerPortalContextMock = vi.fn();
const getControlTowerOpsSummaryMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/control-tower/viewer", () => ({
  getControlTowerPortalContext: getControlTowerPortalContextMock,
}));

vi.mock("@/lib/control-tower/ops-summary", () => ({
  getControlTowerOpsSummary: getControlTowerOpsSummaryMock,
}));

describe("GET /api/control-tower/ops/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getControlTowerPortalContextMock.mockResolvedValue({ timezone: "UTC" });
    getControlTowerOpsSummaryMock.mockResolvedValue({ overdueShipmentCount: 4 });
  });

  it("returns gate response parity when grant check denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden." }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response).toBe(gate);
  });

  it("returns stable tenant-missing error payload", async () => {
    getDemoTenantMock.mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Tenant not found.", code: "NOT_FOUND" });
  });

  it("returns stable actor-missing error payload", async () => {
    getActorUserIdMock.mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No active user.", code: "FORBIDDEN" });
  });

  it("returns ops summary payload on happy path", async () => {
    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ overdueShipmentCount: 4 });
    expect(getControlTowerPortalContextMock).toHaveBeenCalledWith("user-1");
    expect(getControlTowerOpsSummaryMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      ctx: { timezone: "UTC" },
      actorUserId: "user-1",
    });
  });
});
