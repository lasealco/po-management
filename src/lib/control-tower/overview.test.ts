import { beforeEach, describe, expect, it, vi } from "vitest";

const groupBy = vi.hoisted(() => vi.fn());
const shipmentCount = vi.hoisted(() => vi.fn());
const shipmentFindMany = vi.hoisted(() => vi.fn());
const ctAlertCount = vi.hoisted(() => vi.fn());
const ctExceptionCount = vi.hoisted(() => vi.fn());
const getPurchaseOrderScopeWhereMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/org-scope", async (importOriginal) => {
  const act = await importOriginal<typeof import("@/lib/org-scope")>();
  return { ...act, getPurchaseOrderScopeWhere: getPurchaseOrderScopeWhereMock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: {
      groupBy,
      count: shipmentCount,
      findMany: shipmentFindMany,
    },
    ctAlert: { count: ctAlertCount },
    ctException: { count: ctExceptionCount },
  },
}));

import { getControlTowerOverview } from "./overview";

const ctxInternal = {
  isRestrictedView: false,
  isSupplierPortal: false,
  customerCrmAccountId: null as string | null,
};

describe("getControlTowerOverview", () => {
  beforeEach(() => {
    groupBy.mockReset();
    shipmentCount.mockReset();
    shipmentFindMany.mockReset();
    ctAlertCount.mockReset();
    ctExceptionCount.mockReset();
    getPurchaseOrderScopeWhereMock.mockReset();
    getPurchaseOrderScopeWhereMock.mockResolvedValue(undefined);
  });

  it("aggregates counts for internal viewers", async () => {
    groupBy.mockResolvedValueOnce([
      { status: "IN_TRANSIT", _count: { _all: 4 } },
      { status: "BOOKED", _count: { _all: 2 } },
    ]);
    ctAlertCount
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    ctExceptionCount.mockResolvedValueOnce(3).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    shipmentCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(7);
    shipmentFindMany.mockResolvedValueOnce([]);

    const out = await getControlTowerOverview({
      tenantId: "t1",
      ctx: ctxInternal,
      actorUserId: "a1",
    });

    expect(out.isCustomerView).toBe(false);
    expect(out.counts.active).toBe(6);
    expect(out.counts.byStatus.IN_TRANSIT).toBe(4);
    expect(out.counts.byStatus.BOOKED).toBe(2);
    expect(out.counts.openAlerts).toBe(6);
    expect(out.counts.openExceptions).toBe(3);
    expect(out.counts.staleShipments).toBe(5);
    expect(out.counts.arrivalsNext3Days).toBe(1);
    expect(out.counts.arrivalsNext7Days).toBe(2);
    expect(out.counts.arrivalsNext14Days).toBe(3);
    expect(out.counts.withLegs).toBe(10);
    expect(out.counts.withContainers).toBe(8);
    expect(out.counts.overdueEta).toBe(7);
    expect(out.counts.unassignedOpenAlerts).toBe(1);
    expect(out.counts.unassignedOpenExceptions).toBe(0);
    expect(out.counts.slaBreachedAlerts).toBe(2);
    expect(out.counts.slaBreachedExceptions).toBe(1);
    expect(out.counts.openSlaEscalationAlerts).toBe(0);
    expect(out.staleTop).toEqual([]);
  });

  it("nulls internal-only alert columns for restricted portal context", async () => {
    groupBy.mockResolvedValueOnce([{ status: "SHIPPED", _count: { _all: 1 } }]);
    shipmentCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    shipmentFindMany.mockResolvedValueOnce([]);

    const out = await getControlTowerOverview({
      tenantId: "t1",
      ctx: {
        isRestrictedView: true,
        isSupplierPortal: true,
        customerCrmAccountId: null,
      },
      actorUserId: "a1",
    });

    expect(out.isCustomerView).toBe(true);
    expect(out.portal.supplierPortal).toBe(true);
    expect(out.counts.openAlerts).toBeNull();
    expect(out.counts.openExceptions).toBeNull();
    expect(out.counts.unassignedOpenAlerts).toBeNull();
    expect(out.counts.slaBreachedAlerts).toBeNull();
    expect(ctAlertCount).not.toHaveBeenCalled();
    expect(ctExceptionCount).not.toHaveBeenCalled();
  });

  it("maps staleTop rows with ISO timestamps", async () => {
    groupBy.mockResolvedValueOnce([]);
    ctAlertCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    ctExceptionCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    shipmentCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const eta = new Date("2026-05-01T00:00:00.000Z");
    const updatedAt = new Date("2026-04-01T00:00:00.000Z");
    shipmentFindMany.mockResolvedValueOnce([
      {
        id: "s1",
        shipmentNo: "SN-1",
        status: "IN_TRANSIT",
        updatedAt,
        order: { orderNumber: "PO-9" },
        booking: { eta },
      },
    ]);

    const out = await getControlTowerOverview({
      tenantId: "t1",
      ctx: ctxInternal,
      actorUserId: "a1",
    });
    expect(out.staleTop).toEqual([
      {
        id: "s1",
        shipmentNo: "SN-1",
        orderNumber: "PO-9",
        status: "IN_TRANSIT",
        bookingEta: eta.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);
  });
});
