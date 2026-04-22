import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getCtxMock = vi.fn();
const listShipmentsMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/control-tower/viewer", () => ({
  getControlTowerPortalContext: getCtxMock,
}));

vi.mock("@/lib/control-tower/list-shipments", () => ({
  listControlTowerShipments: listShipmentsMock,
}));

describe("GET /api/control-tower/shipments", () => {
  const portalCtx = {
    isRestrictedView: false,
    isSupplierPortal: false,
    customerCrmAccountId: null as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getCtxMock.mockResolvedValue(portalCtx);
    listShipmentsMock.mockResolvedValue({
      rows: [],
      listLimit: 60,
      truncated: false,
    });
  });

  it("uses productTrace as q when q is omitted", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/control-tower/shipments?productTrace=SKU-99"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { q: string | null; productTrace: string | null };
    expect(body.q).toBe("SKU-99");
    expect(body.productTrace).toBe("SKU-99");
    expect(listShipmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ q: "SKU-99" }),
      }),
    );
  });

  it("prefers q over productTrace when both are present", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/control-tower/shipments?q=PO-1&productTrace=SKU-99"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { q: string | null; productTrace: string | null };
    expect(body.q).toBe("PO-1");
    expect(body.productTrace).toBe("SKU-99");
    expect(listShipmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ q: "PO-1" }),
      }),
    );
  });

  it("passes undefined q when productTrace is malformed", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/control-tower/shipments?productTrace=bad token"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { q: string | null; productTrace: string | null };
    expect(body.q).toBeNull();
    expect(body.productTrace).toBeNull();
    expect(listShipmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ q: undefined }),
      }),
    );
  });
});
