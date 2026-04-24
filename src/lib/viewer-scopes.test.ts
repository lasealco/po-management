import { describe, expect, it, vi } from "vitest";

import * as mod from "./viewer-scopes";
import { loadViewerReadScopeBundle } from "./viewer-scopes";

const loadWmsViewReadScope = vi.hoisted(() => vi.fn());
const purchaseOrderWhereWithViewerScope = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wms/wms-read-scope", () => ({
  loadWmsViewReadScope: loadWmsViewReadScope,
}));

vi.mock("@/lib/org-scope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/org-scope")>();
  return {
    ...actual,
    purchaseOrderWhereWithViewerScope: purchaseOrderWhereWithViewerScope,
  };
});

vi.mock("@/lib/authz", () => ({
  actorIsCustomerCrmScoped: vi.fn().mockResolvedValue(false),
  actorIsSupplierPortalRestricted: vi.fn().mockResolvedValue(false),
  userIsSuperuser: vi.fn().mockResolvedValue(false),
}));

describe("viewer-scopes re-exports", () => {
  it("re-exports core scope helpers as functions", () => {
    expect(typeof mod.getPurchaseOrderScopeWhere).toBe("function");
    expect(typeof mod.loadWmsViewReadScope).toBe("function");
    expect(typeof mod.getCrmAccessScope).toBe("function");
    expect(typeof mod.getControlTowerPortalContext).toBe("function");
  });
});

describe("loadViewerReadScopeBundle", () => {
  it("wires mergePurchaseOrderWhere to purchaseOrderWhereWithViewerScope", async () => {
    const wms = { crmAccess: { mode: "tenant" } } as import("@/lib/wms/wms-read-scope").WmsViewReadScope;
    loadWmsViewReadScope.mockResolvedValue(wms);
    purchaseOrderWhereWithViewerScope.mockImplementation(async (_t, _a, base) => base);

    const b = await loadViewerReadScopeBundle("t1", "u1");
    const merged = await b.mergePurchaseOrderWhere({ splitParentId: null });
    expect(merged).toEqual({ splitParentId: null });
    expect(purchaseOrderWhereWithViewerScope).toHaveBeenCalledWith(
      "t1",
      "u1",
      { splitParentId: null },
      { isSupplierPortalUser: false },
    );
  });
});
