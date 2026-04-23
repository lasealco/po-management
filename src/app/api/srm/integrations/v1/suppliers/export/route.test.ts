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
    supplier: { findMany: findManyMock },
  },
}));

const sampleRow = {
  id: "s-1",
  name: "Acme",
  code: "AC-1",
  email: "a@x.com",
  phone: null,
  isActive: true,
  srmCategory: "product" as const,
  approvalStatus: "approved" as const,
  updatedAt: new Date("2026-01-10T00:00:00.000Z"),
};

describe("GET /api/srm/integrations/v1/suppliers/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    findManyMock.mockResolvedValue([sampleRow]);
    getActorUserIdMock.mockResolvedValue("u1");
    loadGlobalGrantsForUserMock.mockResolvedValue(
      new Set(["org.suppliers\u0000edit", "org.suppliers\u0000view"]),
    );
  });

  it("returns gate when org.suppliers view is denied", async () => {
    const gate = new Response(null, { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/export"));
    expect(res).toBe(gate);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns 404 when tenant missing", async () => {
    getDemoTenantMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/export"));
    expect(res.status).toBe(404);
  });

  it("returns JSON list with schemaVersion 1", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/export?format=json"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      schemaVersion: number;
      kind: string;
      suppliers: { id: string; email: string | null }[];
    };
    expect(body.schemaVersion).toBe(1);
    expect(body.kind).toBe("all");
    expect(body.suppliers).toHaveLength(1);
    expect(body.suppliers[0].id).toBe("s-1");
    expect(body.suppliers[0].email).toBe("a@x.com");
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1" } }),
    );
  });

  it("redacts email and phone in JSON export for view-only", async () => {
    loadGlobalGrantsForUserMock.mockResolvedValueOnce(new Set(["org.suppliers\u0000view"]));
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/export?format=json"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { suppliers: { email: string | null; phone: string | null }[] };
    expect(body.suppliers[0].email).toBeNull();
  });

  it("passes srmCategory filter for kind=logistics", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/export?format=json&kind=logistics"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kind: string };
    expect(body.kind).toBe("logistics");
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", srmCategory: "logistics" },
      }),
    );
  });

  it("returns CSV when format=csv", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/export?format=csv&kind=product"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const text = await res.text();
    expect(text).toContain("id,name,code");
    expect(text).toContain("s-1");
    expect(text).toContain("Acme");
  });
});
