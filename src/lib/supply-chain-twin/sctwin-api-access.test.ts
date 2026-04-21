import { beforeEach, describe, expect, it, vi } from "vitest";

const { getViewerGrantSetMock, resolveNavStateMock, actorIsSupplierPortalRestrictedMock } = vi.hoisted(() => ({
  getViewerGrantSetMock: vi.fn(),
  resolveNavStateMock: vi.fn(),
  actorIsSupplierPortalRestrictedMock: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  getViewerGrantSet: getViewerGrantSetMock,
  actorIsSupplierPortalRestricted: actorIsSupplierPortalRestrictedMock,
}));

vi.mock("@/lib/nav-visibility", () => ({
  resolveNavState: resolveNavStateMock,
}));

import {
  requireTwinApiAccess,
  TWIN_API_ERROR_NO_DEMO_USER,
  TWIN_API_ERROR_SUPPLIER_PORTAL_FORBIDDEN,
  TWIN_API_ERROR_VISIBILITY_FORBIDDEN,
} from "@/lib/supply-chain-twin/sctwin-api-access";

const sampleAccess = {
  tenant: { id: "t1", name: "Demo", slug: "demo-company" },
  user: { id: "u1", email: "x@y.com", name: "X" },
  grantSet: new Set<string>(),
};

describe("requireTwinApiAccess (Slice 25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies when there is no demo user", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: sampleAccess.tenant,
      user: null,
      grantSet: new Set(),
    });

    const out = await requireTwinApiAccess();
    expect(out).toEqual({ ok: false, denied: { status: 403, error: TWIN_API_ERROR_NO_DEMO_USER } });
    expect(actorIsSupplierPortalRestrictedMock).not.toHaveBeenCalled();
    expect(resolveNavStateMock).not.toHaveBeenCalled();
  });

  it("denies supplier portal sessions before nav visibility", async () => {
    getViewerGrantSetMock.mockResolvedValue(sampleAccess);
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(true);

    const out = await requireTwinApiAccess();
    expect(out).toEqual({ ok: false, denied: { status: 403, error: TWIN_API_ERROR_SUPPLIER_PORTAL_FORBIDDEN } });
    expect(actorIsSupplierPortalRestrictedMock).toHaveBeenCalledWith("u1");
    expect(resolveNavStateMock).not.toHaveBeenCalled();
  });

  it("denies when twin is not visible for the session", async () => {
    getViewerGrantSetMock.mockResolvedValue(sampleAccess);
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: false },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });

    const out = await requireTwinApiAccess();
    expect(out).toEqual({ ok: false, denied: { status: 403, error: TWIN_API_ERROR_VISIBILITY_FORBIDDEN } });
  });

  it("allows when user is present, not portal-restricted, and twin is visible", async () => {
    getViewerGrantSetMock.mockResolvedValue(sampleAccess);
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: true },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });

    const out = await requireTwinApiAccess();
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.access.user.id).toBe("u1");
      expect(out.access.tenant.id).toBe("t1");
    }
  });
});
