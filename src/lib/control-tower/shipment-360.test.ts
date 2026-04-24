import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstShipment = vi.hoisted(() => vi.fn());
const getPurchaseOrderScopeWhereMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/org-scope", async (importOriginal) => {
  const act = await importOriginal<typeof import("@/lib/org-scope")>();
  return { ...act, getPurchaseOrderScopeWhere: getPurchaseOrderScopeWhereMock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: { findFirst: findFirstShipment },
  },
}));

import { getShipment360 } from "./shipment-360";

describe("getShipment360", () => {
  beforeEach(() => {
    findFirstShipment.mockReset();
    getPurchaseOrderScopeWhereMock.mockReset();
    findFirstShipment.mockResolvedValue(null);
    getPurchaseOrderScopeWhereMock.mockResolvedValue(undefined);
  });

  it("returns null when shipment is not found for tenant scope", async () => {
    const r = await getShipment360({
      tenantId: "tenant-a",
      shipmentId: "ship-missing",
      ctx: {
        isRestrictedView: false,
        isSupplierPortal: false,
        customerCrmAccountId: null,
      },
      actorUserId: "user-1",
    });
    expect(r).toBeNull();
    expect(findFirstShipment).toHaveBeenCalledTimes(1);
    expect(findFirstShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "ship-missing",
          order: { tenantId: "tenant-a" },
        },
      }),
    );
  });

  it("scopes findFirst to customer CRM account in restricted portal context", async () => {
    await getShipment360({
      tenantId: "tenant-a",
      shipmentId: "ship-1",
      ctx: {
        isRestrictedView: true,
        isSupplierPortal: false,
        customerCrmAccountId: "crm-99",
      },
      actorUserId: "user-1",
    });
    expect(findFirstShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "ship-1",
          order: { tenantId: "tenant-a" },
          customerCrmAccountId: "crm-99",
        },
      }),
    );
  });

  it("adds supplier-portal order filter to scope", async () => {
    await getShipment360({
      tenantId: "tenant-b",
      shipmentId: "ship-2",
      ctx: {
        isRestrictedView: true,
        isSupplierPortal: true,
        customerCrmAccountId: null,
      },
      actorUserId: "user-2",
    });
    expect(findFirstShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "ship-2",
          order: { tenantId: "tenant-b", workflow: { supplierPortalOn: true } },
        },
      }),
    );
  });
});
