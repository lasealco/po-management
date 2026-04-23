import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const loadGlobalGrantsForUserMock = vi.fn();
const getDemoTenantMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: (...a: unknown[]) => getActorUserIdMock(...a),
  loadGlobalGrantsForUser: (...a: unknown[]) => loadGlobalGrantsForUserMock(...a),
  viewerHas: (set: Set<string>, resource: string, action: string) =>
    set.has(`${resource}\u0000${action}`),
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: {
      findMany: findManyMock,
    },
  },
}));

describe("GET /api/suppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("u1");
    loadGlobalGrantsForUserMock.mockResolvedValue(
      new Set(["org.suppliers\u0000edit", "org.suppliers\u0000view"]),
    );
  });

  it("returns gate when requireApiGrant denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res).toBe(gate);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns 404 when tenant missing", async () => {
    getDemoTenantMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns suppliers for tenant when authorized", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "s1",
        name: "Acme",
        email: "a@x.com",
        offices: [],
        _count: { offices: 1, productSuppliers: 2 },
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { suppliers: { id: string; email: string | null }[] };
    expect(body.suppliers).toHaveLength(1);
    expect(body.suppliers[0].id).toBe("s1");
    expect(body.suppliers[0].email).toBe("a@x.com");
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1" },
      }),
    );
  });

  it("redacts top-level sensitive fields for view-only", async () => {
    loadGlobalGrantsForUserMock.mockResolvedValueOnce(new Set(["org.suppliers\u0000view"]));
    findManyMock.mockResolvedValueOnce([
      {
        id: "s1",
        name: "Acme",
        email: "a@x.com",
        taxId: "T1",
        _count: { offices: 0, productSuppliers: 0 },
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { suppliers: { email: string | null; taxId: string | null }[] };
    expect(body.suppliers[0].email).toBeNull();
    expect(body.suppliers[0].taxId).toBeNull();
  });
});
