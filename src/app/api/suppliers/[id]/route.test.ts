import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const findFirstMock = vi.fn();
const getActorUserIdMock = vi.fn();
const loadGlobalGrantsForUserMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: (...args: unknown[]) => getActorUserIdMock(...args),
  loadGlobalGrantsForUser: (...args: unknown[]) => loadGlobalGrantsForUserMock(...args),
  viewerHas: (set: Set<string>, resource: string, action: string) =>
    set.has(`${resource}\0${action}`),
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
    getActorUserIdMock.mockResolvedValue("u1");
    loadGlobalGrantsForUserMock.mockResolvedValue(
      new Set(["org.suppliers\u0000edit", "org.suppliers\u0000view"]),
    );
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
      internalNotes: "secret",
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
    expect(body.supplier.internalNotes).toBe("secret");
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1", tenantId: "tenant-1" },
      }),
    );
  });

  it("redacts sensitive fields for view-only supplier access", async () => {
    loadGlobalGrantsForUserMock.mockResolvedValueOnce(new Set(["org.suppliers\u0000view"]));
    findFirstMock.mockResolvedValueOnce({
      id: "s1",
      name: "Acme",
      internalNotes: "secret",
      taxId: "EIN-1",
      creditLimit: "99",
      creditCurrency: "USD",
      offices: [],
      contacts: [{ id: "c1", notes: "n1", name: "x" }],
      _count: { productSuppliers: 0, orders: 0 },
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/suppliers/s1"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      supplier: {
        internalNotes: string | null;
        taxId: string | null;
        creditLimit: unknown;
        creditCurrency: string | null;
        contacts: { notes: string | null }[];
      };
    };
    expect(body.supplier.internalNotes).toBeNull();
    expect(body.supplier.taxId).toBeNull();
    expect(body.supplier.creditLimit).toBeNull();
    expect(body.supplier.creditCurrency).toBeNull();
    expect(body.supplier.contacts[0].notes).toBeNull();
  });
});
