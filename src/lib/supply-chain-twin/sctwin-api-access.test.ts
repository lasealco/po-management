import { beforeEach, describe, expect, it, vi } from "vitest";

const { getViewerGrantSetMock, resolveNavStateMock, actorIsSupplierPortalRestrictedMock } = vi.hoisted(() => ({
  getViewerGrantSetMock: vi.fn(),
  resolveNavStateMock: vi.fn(),
  actorIsSupplierPortalRestrictedMock: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  getViewerGrantSet: getViewerGrantSetMock,
  actorIsSupplierPortalRestricted: actorIsSupplierPortalRestrictedMock,
  viewerHas: (grantSet: Set<string>, resource: string, action: string) => grantSet.has(`${resource}\0${action}`),
}));

vi.mock("@/lib/nav-visibility", () => ({
  resolveNavState: resolveNavStateMock,
}));

import {
  isTwinModuleEnabledForTenant,
  TWIN_API_ERROR_MODULE_DISABLED,
  requireTwinApiAccess,
  TWIN_API_ERROR_NO_DEMO_USER,
  TWIN_API_ERROR_SUPPLIER_PORTAL_FORBIDDEN,
  TWIN_API_ERROR_VISIBILITY_FORBIDDEN,
  requireTwinMaintenanceAccess,
  TWIN_API_ERROR_ADMIN_FORBIDDEN,
} from "@/lib/supply-chain-twin/sctwin-api-access";

const sampleAccess = {
  tenant: { id: "t1", name: "Demo", slug: "demo-company" },
  user: { id: "u1", email: "x@y.com", name: "X" },
  grantSet: new Set<string>(),
};

describe("requireTwinApiAccess (Slice 25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCTWIN_FORCE_DISABLE;
    delete process.env.SCTWIN_DISABLED_TENANT_SLUGS;
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

  it("denies when module entitlement gate disables tenant", async () => {
    getViewerGrantSetMock.mockResolvedValue(sampleAccess);
    process.env.SCTWIN_DISABLED_TENANT_SLUGS = "demo-company";

    const out = await requireTwinApiAccess();
    expect(out).toEqual({ ok: false, denied: { status: 403, error: TWIN_API_ERROR_MODULE_DISABLED } });
    expect(actorIsSupplierPortalRestrictedMock).not.toHaveBeenCalled();
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

describe("isTwinModuleEnabledForTenant", () => {
  beforeEach(() => {
    delete process.env.SCTWIN_FORCE_DISABLE;
    delete process.env.SCTWIN_DISABLED_TENANT_SLUGS;
  });

  it("defaults to enabled", () => {
    expect(isTwinModuleEnabledForTenant("demo-company")).toBe(true);
  });

  it("disables all tenants when force flag is set", () => {
    process.env.SCTWIN_FORCE_DISABLE = "true";
    expect(isTwinModuleEnabledForTenant("demo-company")).toBe(false);
  });

  it("disables only listed tenant slugs", () => {
    process.env.SCTWIN_DISABLED_TENANT_SLUGS = "tenant-a, demo-company";
    expect(isTwinModuleEnabledForTenant("tenant-a")).toBe(false);
    expect(isTwinModuleEnabledForTenant("demo-company")).toBe(false);
    expect(isTwinModuleEnabledForTenant("tenant-b")).toBe(true);
  });
});

describe("requireTwinMaintenanceAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCTWIN_FORCE_DISABLE;
    delete process.env.SCTWIN_DISABLED_TENANT_SLUGS;
    getViewerGrantSetMock.mockResolvedValue(sampleAccess);
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: true },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });
  });

  it("denies when org.settings edit grant is missing", async () => {
    const out = await requireTwinMaintenanceAccess();
    expect(out).toEqual({ ok: false, denied: { status: 403, error: TWIN_API_ERROR_ADMIN_FORBIDDEN } });
  });

  it("allows when org.settings edit grant is present", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      ...sampleAccess,
      grantSet: new Set(["org.settings\0edit"]),
    });

    const out = await requireTwinMaintenanceAccess();
    expect(out.ok).toBe(true);
  });
});
