import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyShipments = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: {
      findMany: findManyShipments,
    },
  },
}));

import { buildControlTowerDigest, DIGEST_MAX_ITEMS } from "./customer-digest";

describe("buildControlTowerDigest", () => {
  const ctx = {
    isRestrictedView: false,
    isSupplierPortal: false,
    customerCrmAccountId: null as string | null,
  };

  beforeEach(() => {
    findManyShipments.mockReset();
  });

  it("maps prisma rows to digest items with latestEta over eta", async () => {
    const eta = new Date("2026-05-01T00:00:00.000Z");
    const latestEta = new Date("2026-05-10T00:00:00.000Z");
    findManyShipments.mockResolvedValue([
      {
        id: "s1",
        shipmentNo: "SN-1",
        status: "IN_TRANSIT",
        booking: {
          eta,
          latestEta,
          originCode: "A",
          destinationCode: "B",
        },
        milestones: [{ code: "M1", actualAt: null }],
      },
    ]);
    const out = await buildControlTowerDigest({ tenantId: "t1", ctx });
    expect(findManyShipments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { order: { tenantId: "t1" } },
        take: DIGEST_MAX_ITEMS,
      }),
    );
    expect(out.itemCount).toBe(1);
    expect(out.truncated).toBe(false);
    expect(out.view).toEqual({
      restricted: false,
      supplierPortal: false,
      customerCrmAccountId: null,
    });
    expect(out.items[0]).toMatchObject({
      id: "s1",
      shipmentNo: "SN-1",
      status: "IN_TRANSIT",
      eta: latestEta.toISOString(),
      originCode: "A",
      destinationCode: "B",
      latestMilestone: { code: "M1", hasActual: false },
    });
  });

  it("sets truncated when result length reaches digest limit", async () => {
    const rows = Array.from({ length: DIGEST_MAX_ITEMS }, (_, i) => ({
      id: `s-${i}`,
      shipmentNo: null,
      status: "BOOKED",
      booking: null,
      milestones: [],
    }));
    findManyShipments.mockResolvedValue(rows);
    const out = await buildControlTowerDigest({ tenantId: "t1", ctx });
    expect(out.truncated).toBe(true);
    expect(out.itemCount).toBe(DIGEST_MAX_ITEMS);
  });

  it("reflects restricted portal context in payload", async () => {
    findManyShipments.mockResolvedValue([]);
    const out = await buildControlTowerDigest({
      tenantId: "t1",
      ctx: {
        isRestrictedView: true,
        isSupplierPortal: true,
        customerCrmAccountId: "crm-x",
      },
    });
    expect(out.view).toEqual({
      restricted: true,
      supplierPortal: true,
      customerCrmAccountId: "crm-x",
    });
    expect(findManyShipments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerCrmAccountId: "crm-x",
          order: { tenantId: "t1", workflow: { supplierPortalOn: true } },
        },
      }),
    );
  });
});
