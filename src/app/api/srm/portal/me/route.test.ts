import { beforeEach, describe, expect, it, vi } from "vitest";

const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const loadPortalLinkedSupplierMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/srm/portal-linked-supplier", () => ({
  loadPortalLinkedSupplier: loadPortalLinkedSupplierMock,
}));

describe("GET /api/srm/portal/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "t1" });
  });

  it("returns 403 when not signed in", async () => {
    getActorUserIdMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 when actor is not a supplier portal user", async () => {
    getActorUserIdMock.mockResolvedValue("u1");
    loadPortalLinkedSupplierMock.mockResolvedValue({ ok: false, reason: "not_portal" });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with supplier when linked", async () => {
    getActorUserIdMock.mockResolvedValue("u1");
    loadPortalLinkedSupplierMock.mockResolvedValue({
      ok: true,
      supplier: {
        id: "s1",
        code: "SUP-001",
        name: "Acme",
        legalName: null,
        email: null,
        phone: null,
        approvalStatus: "approved",
        srmOnboardingStage: "intake",
        srmCategory: "product",
        registeredCity: null,
        registeredRegion: null,
        registeredCountryCode: null,
        website: null,
      },
    });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { supplier: { name: string } };
    expect(body.supplier.name).toBe("Acme");
  });
});
