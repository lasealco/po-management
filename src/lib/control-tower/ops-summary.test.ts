import { beforeEach, describe, expect, it, vi } from "vitest";

const ctAlertCount = vi.hoisted(() => vi.fn());
const ctExceptionCount = vi.hoisted(() => vi.fn());
const ctAuditLogCount = vi.hoisted(() => vi.fn());
const ctAuditLogFindMany = vi.hoisted(() => vi.fn());
const userFindMany = vi.hoisted(() => vi.fn());
const ctExceptionGroupBy = vi.hoisted(() => vi.fn());
const shipmentFindMany = vi.hoisted(() => vi.fn());
const ctShipmentNoteCount = vi.hoisted(() => vi.fn());
const getPurchaseOrderScopeWhereMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/org-scope", async (importOriginal) => {
  const act = await importOriginal<typeof import("@/lib/org-scope")>();
  return { ...act, getPurchaseOrderScopeWhere: getPurchaseOrderScopeWhereMock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ctAlert: { count: ctAlertCount },
    ctException: { count: ctExceptionCount, groupBy: ctExceptionGroupBy },
    ctAuditLog: { count: ctAuditLogCount, findMany: ctAuditLogFindMany },
    user: { findMany: userFindMany },
    shipment: { findMany: shipmentFindMany },
    ctShipmentNote: { count: ctShipmentNoteCount },
  },
}));

import { getControlTowerOpsSummary } from "./ops-summary";

const ctxInternal = {
  isRestrictedView: false,
  isSupplierPortal: false,
  customerCrmAccountId: null as string | null,
};

describe("getControlTowerOpsSummary", () => {
  beforeEach(() => {
    ctAlertCount.mockReset();
    ctExceptionCount.mockReset();
    ctAuditLogCount.mockReset();
    ctAuditLogFindMany.mockReset();
    userFindMany.mockReset();
    ctExceptionGroupBy.mockReset();
    shipmentFindMany.mockReset();
    ctShipmentNoteCount.mockReset();
    getPurchaseOrderScopeWhereMock.mockReset();
    getPurchaseOrderScopeWhereMock.mockResolvedValue(undefined);
  });

  it("aggregates SLA, owners, exceptions, route ETA, and ops console for internal users", async () => {
    ctAlertCount.mockResolvedValueOnce(11).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    ctExceptionCount.mockResolvedValueOnce(6).mockResolvedValueOnce(1);
    ctAuditLogCount.mockResolvedValueOnce(1).mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    ctAuditLogFindMany.mockResolvedValueOnce([
      {
        id: "log-1",
        action: "sla_escalation",
        createdAt: new Date("2026-04-01T12:00:00.000Z"),
        actor: { name: "Cron" },
      },
    ]);
    userFindMany.mockResolvedValueOnce([
      {
        id: "u1",
        name: "Pat",
        _count: { ctAlertsOwned: 14, ctExceptionsOwned: 1 },
      },
    ]);
    ctExceptionGroupBy.mockResolvedValueOnce([{ type: "DOC", _count: { _all: 4 } }]);
    const eta = new Date("2026-05-10T00:00:00.000Z");
    const receivedAt = new Date("2026-05-09T00:00:00.000Z");
    shipmentFindMany.mockResolvedValueOnce([{ id: "s1", booking: { eta }, receivedAt }]);
    ctShipmentNoteCount.mockResolvedValueOnce(7);

    const out = await getControlTowerOpsSummary({ tenantId: "t1", ctx: ctxInternal, actorUserId: "a1" });

    expect(out.isCustomerView).toBe(false);
    expect(out.slaOps).toEqual({
      backlogAlerts: 11,
      backlogExceptions: 6,
      staleBacklogAlerts: 3,
      staleBacklogExceptions: 1,
      escalationRuns24h: 1,
      escalationSweepRuns7d: 5,
      escalationActions7d: 2,
    });
    expect(out.ownerBalancing).not.toBeNull();
    expect(out.ownerBalancing!.overloadedOwners).toBe(1);
    expect(out.ownerBalancing!.topOwners[0]).toMatchObject({
      id: "u1",
      name: "Pat",
      total: 15,
    });
    expect(out.exceptionLifecycle).toEqual({
      openByType: [{ type: "DOC", count: 4 }],
    });
    expect(out.routeEta).toEqual({
      deliveredCompared: 1,
      onTimePct: 100,
      delayedPct: 0,
      onTimeCount: 1,
      delayedCount: 0,
    });
    expect(out.collaboration).toEqual({
      mentionAlertsOpen: 2,
      sharedNotes7d: 7,
    });
    expect(out.opsConsole?.recentRuns[0]).toMatchObject({
      id: "log-1",
      action: "sla_escalation",
      actorName: "Cron",
    });
  });

  it("omits internal ops slices for restricted portal but keeps route ETA and shared notes", async () => {
    shipmentFindMany.mockResolvedValueOnce([]);
    ctShipmentNoteCount.mockResolvedValueOnce(3);

    const out = await getControlTowerOpsSummary({
      tenantId: "t1",
      ctx: {
        isRestrictedView: true,
        isSupplierPortal: true,
        customerCrmAccountId: null,
      },
      actorUserId: "a1",
    });

    expect(out.isCustomerView).toBe(true);
    expect(out.slaOps.backlogAlerts).toBeNull();
    expect(out.ownerBalancing).toBeNull();
    expect(out.exceptionLifecycle).toBeNull();
    expect(out.opsConsole).toBeNull();
    expect(out.collaboration.mentionAlertsOpen).toBeNull();
    expect(out.collaboration.sharedNotes7d).toBe(3);
    expect(out.routeEta.deliveredCompared).toBe(0);
    expect(ctAlertCount).not.toHaveBeenCalled();
  });
});
