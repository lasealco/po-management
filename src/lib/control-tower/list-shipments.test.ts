import { beforeEach, describe, expect, it, vi } from "vitest";

const shipmentFindMany = vi.hoisted(() => vi.fn());
const ensureBookingConfirmationSlaAlerts = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: { findMany: shipmentFindMany },
  },
}));

vi.mock("./booking-sla", () => ({
  ensureBookingConfirmationSlaAlerts,
}));

import { listControlTowerShipments } from "./list-shipments";

const ctxInternal = {
  isRestrictedView: false,
  isSupplierPortal: false,
  customerCrmAccountId: null as string | null,
};

const ctxRestricted = {
  isRestrictedView: true,
  isSupplierPortal: false,
  customerCrmAccountId: "crm-1" as string | null,
};

describe("listControlTowerShipments", () => {
  beforeEach(() => {
    shipmentFindMany.mockReset();
    ensureBookingConfirmationSlaAlerts.mockReset();
    shipmentFindMany.mockResolvedValue([]);
    ensureBookingConfirmationSlaAlerts.mockResolvedValue(undefined);
  });

  it("uses default take 80 and runs booking SLA sweep for internal lists", async () => {
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: {},
    });
    expect(out.rows).toEqual([]);
    expect(out.listLimit).toBe(80);
    expect(out.truncated).toBe(false);
    expect(shipmentFindMany.mock.calls[0]![0]).toMatchObject({
      take: 80,
      orderBy: { updatedAt: "desc" },
    });
    expect(ensureBookingConfirmationSlaAlerts).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      shipmentIds: [],
    });
  });

  it("clamps take to 200", async () => {
    const out = await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { take: 999 },
    });
    expect(out.listLimit).toBe(200);
    expect(shipmentFindMany.mock.calls[0]![0].take).toBe(200);
  });

  it("overscans DB when routeActionPrefix is set", async () => {
    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxInternal,
      query: { routeActionPrefix: "Plan leg", take: 10 },
    });
    expect(shipmentFindMany.mock.calls[0]![0].take).toBe(120);
  });

  it("does not call booking SLA sweep in restricted portal lists", async () => {
    await listControlTowerShipments({
      tenantId: "tenant-1",
      ctx: ctxRestricted,
      query: { take: 25 },
    });
    expect(ensureBookingConfirmationSlaAlerts).not.toHaveBeenCalled();
    expect(shipmentFindMany.mock.calls[0]![0].take).toBe(25);
  });
});
