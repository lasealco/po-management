import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const findFirstMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: vi.fn(),
  loadGlobalGrantsForUser: vi.fn(),
  viewerHas: vi.fn(),
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: {
      findFirst: findFirstMock,
    },
  },
}));

describe("GET /api/suppliers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
  });

  it("returns gate when requireApiGrant denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/suppliers/x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res).toBe(gate);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("returns 404 when supplier not in tenant", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/suppliers/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns supplier when found", async () => {
    findFirstMock.mockResolvedValueOnce({
      id: "s1",
      name: "Acme",
      offices: [],
      contacts: [],
      _count: { productSuppliers: 0, orders: 0 },
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/suppliers/s1"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supplier.id).toBe("s1");
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1", tenantId: "tenant-1" },
      }),
    );
  });
});
