import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const docFindFirstMock = vi.fn();
const logFindManyMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    srmSupplierDocument: { findFirst: docFindFirstMock },
    srmSupplierDocumentAuditLog: { findMany: logFindManyMock },
  },
}));

describe("GET /api/suppliers/[id]/srm-documents/[docId]/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
  });

  it("returns gate when requireApiGrant denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/audit"), {
      params: Promise.resolve({ id: "s1", docId: "d1" }),
    });
    expect(res).toBe(gate);
    expect(docFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns 404 when no tenant", async () => {
    getDemoTenantMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/audit"), {
      params: Promise.resolve({ id: "s1", docId: "d1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when document not in tenant or supplier", async () => {
    docFindFirstMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/audit"), {
      params: Promise.resolve({ id: "s1", docId: "missing" }),
    });
    expect(res.status).toBe(404);
    expect(logFindManyMock).not.toHaveBeenCalled();
  });

  it("returns entries when document exists", async () => {
    docFindFirstMock.mockResolvedValueOnce({ id: "d1" });
    const at = new Date("2026-01-10T12:00:00.000Z");
    logFindManyMock.mockResolvedValueOnce([
      {
        id: "log-1",
        at,
        action: "upload",
        details: { fileName: "x.pdf" },
        actor: { id: "u1", name: "A", email: "a@x.com" },
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/audit"), {
      params: Promise.resolve({ id: "s1", docId: "d1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: { id: string; action: string; at: string }[] };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].action).toBe("upload");
    expect(body.entries[0].at).toBe(at.toISOString());
  });
});
