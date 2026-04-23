import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const findFirstMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: {
      findFirst: findFirstMock,
    },
    srmSupplierDocument: {
      findMany: findManyMock,
    },
  },
}));

describe("GET /api/suppliers/[id]/srm-documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
  });

  it("returns gate when requireApiGrant denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/x/srm-documents"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res).toBe(gate);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("returns 404 when supplier missing", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/x/srm-documents"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns documents when authorized", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "s1", name: "Acme", code: "ACME" });
    findManyMock.mockResolvedValueOnce([
      {
        id: "d1",
        documentType: "other",
        status: "active",
        title: null,
        fileName: "a.pdf",
        mimeType: "application/pdf",
        fileSize: 10,
        fileUrl: "https://example.com/a.pdf",
        expiresAt: null,
        revisionGroupId: "d1",
        revisionNumber: 1,
        supersedesDocumentId: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        uploadedBy: { id: "u1", name: "A", email: "a@x.com" },
        lastModifiedBy: null,
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/s1/srm-documents"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { documents: { id: string }[] };
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0].id).toBe("d1");
  });

  it("returns CSV manifest when format=csv (no fileUrl in body)", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "s1", name: "Acme Co", code: "AC-1" });
    findManyMock.mockResolvedValueOnce([
      {
        id: "d1",
        documentType: "other",
        status: "active",
        title: null,
        fileName: "a.pdf",
        mimeType: "application/pdf",
        fileSize: 10,
        fileUrl: "https://example.com/a.pdf",
        expiresAt: null,
        revisionGroupId: "d1",
        revisionNumber: 1,
        supersedesDocumentId: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        uploadedBy: { id: "u1", name: "A", email: "a@x.com" },
        lastModifiedBy: null,
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/s1/srm-documents?format=csv&includeArchived=1"),
      { params: Promise.resolve({ id: "s1" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")?.includes("text/csv")).toBe(true);
    expect(res.headers.get("Content-Disposition")?.includes("attachment")).toBe(true);
    const text = await res.text();
    expect(text).toContain("supplierName,supplierCode");
    expect(text).toContain("Acme Co,AC-1");
    expect(text).not.toContain("fileUrl");
    expect(text).not.toContain("https://example.com");
  });
});

describe("POST /api/suppliers/[id]/srm-documents — grant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies upload when edit grant missing (403 gate)", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    requireApiGrantMock.mockResolvedValue(gate);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(403);
  });
});
