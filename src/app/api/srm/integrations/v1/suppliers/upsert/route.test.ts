import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const loadGlobalGrantsForUserMock = vi.fn();
const getDemoTenantMock = vi.fn();
const runUpsertMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
  loadGlobalGrantsForUser: loadGlobalGrantsForUserMock,
  viewerHas: () => true,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/srm/srm-supplier-upsert-v1", () => ({
  parseSrmSupplierUpsertV1Body: (body: unknown) => {
    if (!body || typeof body !== "object") return { ok: false, response: new Response(null, { status: 400 }) };
    return { ok: true, value: body };
  },
  runSrmSupplierUpsertV1: runUpsertMock,
}));

vi.mock("@/lib/srm/srm-integration-idempotency", () => ({
  SRM_INTEGRATION_UPSERT_SUPPLIER_V1: "supplier_upsert_v1",
  checkSrmIdempotency: vi.fn(),
  storeSrmIdempotency: vi.fn(),
  parseSrmIdempotencyKeyHeader: (req: Request) => {
    const k = req.headers.get("Idempotency-Key");
    if (k && k.length > 256) return { ok: false, error: "too long" };
    return { ok: true, key: k };
  },
  srmBodySha256: () => "deadbeef",
}));

describe("POST /api/srm/integrations/v1/suppliers/upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "t1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    loadGlobalGrantsForUserMock.mockResolvedValue(new Set());
  });

  it("returns 403 when org.suppliers edit gate", async () => {
    const gate = new Response(null, { status: 403 });
    requireApiGrantMock.mockResolvedValue(gate);
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/", { method: "POST" }));
    expect(res).toBe(gate);
  });

  it("replays when idempotency says replay", async () => {
    requireApiGrantMock.mockResolvedValue(null);
    const { checkSrmIdempotency, storeSrmIdempotency } = await import("@/lib/srm/srm-integration-idempotency");
    vi.mocked(checkSrmIdempotency).mockResolvedValue({ type: "replay", statusCode: 201, bodyText: `{"x":1}` });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Idempotency-Key": "k1", "Content-Type": "application/json" },
        body: JSON.stringify({ schemaVersion: 1, supplier: { name: "A" } }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.text();
    expect(body).toBe(`{"x":1}`);
    expect(res.headers.get("X-Idempotent-Replay")).toBe("true");
    expect(storeSrmIdempotency).not.toHaveBeenCalled();
    expect(runUpsertMock).not.toHaveBeenCalled();
  });

  it("returns 409 when idempotency key body conflicts", async () => {
    requireApiGrantMock.mockResolvedValue(null);
    const { checkSrmIdempotency } = await import("@/lib/srm/srm-integration-idempotency");
    vi.mocked(checkSrmIdempotency).mockResolvedValue({ type: "conflict" });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Idempotency-Key": "k1", "Content-Type": "application/json" },
        body: JSON.stringify({ schemaVersion: 1, supplier: { name: "A" } }),
      }),
    );
    expect(res.status).toBe(409);
    const j = (await res.json()) as { code: string };
    expect(j.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("returns 404 when demo tenant is missing", async () => {
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaVersion: 1, supplier: { name: "A" } }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when no actor user", async () => {
    requireApiGrantMock.mockResolvedValue(null);
    getActorUserIdMock.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }),
    );
    expect(res.status).toBe(403);
  });
});
