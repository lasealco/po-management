import { beforeEach, describe, expect, it, vi } from "vitest";

const shipmentGroupBy = vi.hoisted(() => vi.fn());
const shipmentCount = vi.hoisted(() => vi.fn());
const shipmentFindMany = vi.hoisted(() => vi.fn());
const ctAlertCount = vi.hoisted(() => vi.fn());
const ctAlertGroupBy = vi.hoisted(() => vi.fn());
const ctExceptionCount = vi.hoisted(() => vi.fn());
const ctExceptionGroupBy = vi.hoisted(() => vi.fn());
const userFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: {
      groupBy: shipmentGroupBy,
      count: shipmentCount,
      findMany: shipmentFindMany,
    },
    ctAlert: { count: ctAlertCount, groupBy: ctAlertGroupBy },
    ctException: { count: ctExceptionCount, groupBy: ctExceptionGroupBy },
    user: { findMany: userFindMany },
  },
}));

import { getControlTowerReportsSummary } from "./reports-summary";

const ctxInternal = {
  isRestrictedView: false,
  isSupplierPortal: false,
  customerCrmAccountId: null as string | null,
};

describe("getControlTowerReportsSummary", () => {
  beforeEach(() => {
    shipmentGroupBy.mockReset();
    shipmentCount.mockReset();
    shipmentFindMany.mockReset();
    ctAlertCount.mockReset();
    ctAlertGroupBy.mockReset();
    ctExceptionCount.mockReset();
    ctExceptionGroupBy.mockReset();
    userFindMany.mockReset();
  });

  it("aggregates totals and route actions for internal viewers", async () => {
    shipmentGroupBy.mockResolvedValueOnce([{ status: "IN_TRANSIT", _count: { _all: 3 } }]);
    shipmentCount.mockResolvedValueOnce(8);
    ctExceptionCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    ctAlertCount.mockResolvedValueOnce(4).mockResolvedValueOnce(0);

    shipmentFindMany
      .mockResolvedValueOnce([
        { id: "s1", ctLegs: [] },
        {
          id: "s2",
          ctLegs: [
            { plannedEtd: null, plannedEta: null, actualAtd: null, actualAta: null },
          ],
        },
        {
          id: "s3",
          ctLegs: [
            {
              plannedEtd: new Date("2026-01-01"),
              plannedEta: null,
              actualAtd: null,
              actualAta: null,
            },
          ],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    ctAlertGroupBy.mockResolvedValueOnce([
      { ownerUserId: "u1", _count: { _all: 5 } },
      { ownerUserId: null, _count: { _all: 1 } },
    ]);
    ctExceptionGroupBy.mockResolvedValueOnce([{ ownerUserId: "u1", _count: { _all: 3 } }]);
    userFindMany.mockResolvedValueOnce([{ id: "u1", name: "Alex" }]);

    const out = await getControlTowerReportsSummary({ tenantId: "t1", ctx: ctxInternal });

    expect(out.isCustomerView).toBe(false);
    expect(out.totals.shipments).toBe(3);
    expect(out.totals.withBooking).toBe(8);
    expect(out.totals.openExceptions).toBe(2);
    expect(out.totals.slaBreachedAlerts).toBe(4);
    expect(out.totals.slaBreachedExceptions).toBe(1);
    expect(out.totals.openSlaEscalationAlerts).toBe(0);
    expect(out.totals.customerOpenExceptions).toBeNull();

    expect(out.routeActions).toEqual({
      planLeg: 1,
      markDeparture: 1,
      recordArrival: 0,
      routeComplete: 0,
      noLegs: 1,
    });

    expect(out.ownerLoad.alerts.unassigned).toBe(1);
    expect(out.ownerLoad.exceptions.unassigned).toBe(0);
    expect(out.ownerBalancing.combinedTop[0]).toMatchObject({
      ownerUserId: "u1",
      ownerName: "Alex",
      count: 8,
    });
  });

  it("hides internal exception/alert totals for restricted view but keeps customer OPEN exceptions", async () => {
    shipmentGroupBy.mockResolvedValueOnce([]);
    shipmentCount.mockResolvedValueOnce(0);
    ctExceptionCount.mockResolvedValueOnce(9);

    shipmentFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const out = await getControlTowerReportsSummary({
      tenantId: "t1",
      ctx: {
        isRestrictedView: true,
        isSupplierPortal: false,
        customerCrmAccountId: "crm-1",
      },
    });

    expect(out.isCustomerView).toBe(true);
    expect(out.totals.openExceptions).toBeNull();
    expect(out.totals.slaBreachedAlerts).toBeNull();
    expect(out.totals.customerOpenExceptions).toBe(9);
    expect(ctAlertCount).not.toHaveBeenCalled();
    expect(ctAlertGroupBy).not.toHaveBeenCalled();
    expect(ctExceptionGroupBy).not.toHaveBeenCalled();
    expect(userFindMany).not.toHaveBeenCalled();
  });
});
