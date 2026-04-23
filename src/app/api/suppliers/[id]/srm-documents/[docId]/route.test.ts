import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/srm/srm-supplier-document-audit", () => ({
  appendSrmSupplierDocumentAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/srm/srm-supplier-document-helpers", () => ({
  parseSrmSupplierDocumentType: (t: string) => (t === "w9" ? "w9" : null),
  toSrmSupplierDocumentJson: (d: { id: string; status: string; documentType: string }) => ({
    id: d.id,
    status: d.status,
    documentType: d.documentType,
    fileName: "x.pdf",
    fileUrl: "https://x/x.pdf",
    mimeType: "application/pdf",
    fileSize: 1,
    title: null,
    expiresAt: null,
    expirySignal: "none",
    updatedAt: new Date("2026-01-01").toISOString(),
    revisionGroupId: d.id,
    revisionNumber: 1,
    supersedesDocumentId: null,
    uploadedBy: { id: "u1", name: "A", email: "a@x.com" },
    lastModifiedBy: null,
  }),
}));

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: () => getActorUserIdMock(),
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    srmSupplierDocument: { findFirst: findFirstMock, update: updateMock },
  },
}));

describe("PATCH /api/suppliers/[id]/srm-documents/[docId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getActorUserIdMock.mockResolvedValue("actor-1");
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
  });

  it("returns gate when edit grant denied", async () => {
    const gate = new Response(null, { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/", { method: "PATCH", body: JSON.stringify({ status: "archived" }) }),
      { params: Promise.resolve({ id: "s1", docId: "d1" }) },
    );
    expect(res).toBe(gate);
  });

  it("returns 403 when no actor", async () => {
    getActorUserIdMock.mockResolvedValueOnce(null);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/", { method: "PATCH", body: JSON.stringify({ status: "archived" }) }),
      { params: Promise.resolve({ id: "s1", docId: "d1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when document missing", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/", { method: "PATCH", body: JSON.stringify({ status: "archived" }) }),
      { params: Promise.resolve({ id: "s1", docId: "missing" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when no updatable fields", async () => {
    findFirstMock.mockResolvedValueOnce({
      id: "d1",
      uploadedBy: { id: "u1", name: "A", email: "a@x.com" },
      lastModifiedBy: null,
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/", { method: "PATCH", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: "s1", docId: "d1" }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/suppliers/[id]/srm-documents/[docId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getActorUserIdMock.mockResolvedValue("actor-1");
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
  });

  it("denies when edit grant missing", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("http://localhost/"), {
      params: Promise.resolve({ id: "s1", docId: "d1" }),
    });
    expect(res.status).toBe(403);
  });
});
