import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyShipments = vi.hoisted(() => vi.fn());
const findManyExceptionCodes = vi.hoisted(() => vi.fn());
const findUniquePref = vi.hoisted(() => vi.fn());
const findManyFx = vi.hoisted(() => vi.fn());
const getPurchaseOrderScopeWhereMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: { findMany: findManyShipments },
    ctExceptionCode: { findMany: findManyExceptionCodes },
    userPreference: { findUnique: findUniquePref },
    ctFxRate: { findMany: findManyFx },
  },
}));

vi.mock("@/lib/org-scope", async (importOriginal) => {
  const act = await importOriginal<typeof import("@/lib/org-scope")>();
  return { ...act, getPurchaseOrderScopeWhere: getPurchaseOrderScopeWhereMock };
});

import { runControlTowerReport } from "./report-engine";

const portalCtx = {
  isRestrictedView: false,
  isSupplierPortal: false,
  customerCrmAccountId: null as string | null,
};

function shipmentRow(
  id: string,
  pick: {
    shippedAt?: Date;
    customer?: string;
    ctExceptions?: Array<{ type: string }>;
    ctCostLines?: Array<{ amountMinor: bigint; currency: string }>;
  } = {},
) {
  return {
    id,
    status: "IN_TRANSIT" as const,
    transportMode: "OCEAN" as const,
    shippedAt: pick.shippedAt ?? new Date("2026-03-15T12:00:00.000Z"),
    receivedAt: null as Date | null,
    carrierSupplierId: null as string | null,
    carrier: null as string | null,
    carrierSupplier: null as { name: string } | null,
    estimatedVolumeCbm: new Prisma.Decimal("2"),
    estimatedWeightKg: new Prisma.Decimal("100"),
    customerCrmAccount: { name: pick.customer ?? "Acme" },
    order: { supplier: { name: "Supplier A" } },
    booking: {
      originCode: "CNSHA",
      destinationCode: "USLAX",
      eta: null as Date | null,
      latestEta: null as Date | null,
    },
    ctFinancialSnapshots: [] as Array<{ customerVisibleCost: Prisma.Decimal | null; internalCost: Prisma.Decimal | null }>,
    ctCostLines: pick.ctCostLines ?? [],
    ctExceptions: pick.ctExceptions ?? [],
  };
}

describe("runControlTowerReport", () => {
  beforeEach(() => {
    findManyShipments.mockReset();
    findManyExceptionCodes.mockReset();
    findUniquePref.mockReset();
    findManyFx.mockReset();
    getPurchaseOrderScopeWhereMock.mockReset();
    findManyShipments.mockResolvedValue([]);
    findManyExceptionCodes.mockResolvedValue([]);
    findUniquePref.mockResolvedValue(null);
    findManyFx.mockResolvedValue([]);
    getPurchaseOrderScopeWhereMock.mockResolvedValue(undefined);
  });

  it("returns empty series and zero totals when no shipments match", async () => {
    const r = await runControlTowerReport({
      tenantId: "t1",
      ctx: portalCtx,
      actorUserId: "a1",
      configInput: { dimension: "month", measure: "shipments" },
    });
    expect(r.rows).toEqual([]);
    expect(r.fullSeriesRows).toEqual([]);
    expect(r.coverage).toMatchObject({
      totalShipmentsQueried: 0,
      shipmentsAggregated: 0,
      excludedByDateOrMissingDateField: 0,
    });
    expect(r.totals.shipments).toBe(0);
    expect(findManyShipments).toHaveBeenCalledTimes(1);
    expect(findManyExceptionCodes).not.toHaveBeenCalled();
    expect(findUniquePref).toHaveBeenCalledTimes(1);
    expect(findManyFx).not.toHaveBeenCalled();
  });

  it("aggregates by month bucket and counts coverage", async () => {
    findManyShipments.mockResolvedValueOnce([shipmentRow("s1")]);
    const r = await runControlTowerReport({
      tenantId: "t1",
      ctx: portalCtx,
      actorUserId: "a1",
      configInput: { dimension: "month", measure: "shipments" },
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.key).toBe("2026-03");
    expect(r.rows[0]!.metrics.shipments).toBe(1);
    expect(r.coverage.shipmentsAggregated).toBe(1);
    expect(r.coverage.totalShipmentsQueried).toBe(1);
    expect(r.totals.shipments).toBe(1);
  });

  it("excludes shipments outside the date window on shippedAt", async () => {
    findManyShipments.mockResolvedValueOnce([shipmentRow("s1", { shippedAt: new Date("2026-02-01T00:00:00.000Z") })]);
    const r = await runControlTowerReport({
      tenantId: "t1",
      ctx: portalCtx,
      actorUserId: "a1",
      configInput: {
        dimension: "month",
        measure: "shipments",
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
      },
    });
    expect(r.rows).toEqual([]);
    expect(r.coverage.excludedByDateOrMissingDateField).toBe(1);
    expect(r.coverage.shipmentsAggregated).toBe(0);
  });

  it("merges status filter into the Prisma where clause", async () => {
    findManyShipments.mockImplementationOnce(async (args: { where: { AND?: unknown[] } }) => {
      expect(args.where).toMatchObject({
        order: { tenantId: "t1" },
        AND: expect.arrayContaining([{ status: "DELIVERED" }]),
      });
      return [];
    });
    await runControlTowerReport({
      tenantId: "t1",
      ctx: portalCtx,
      actorUserId: "a1",
      configInput: {
        dimension: "customer",
        measure: "shipments",
        filters: { status: "DELIVERED" },
      },
    });
  });

  it("applies topN for non-month dimensions on chart rows only", async () => {
    findManyShipments.mockResolvedValueOnce([
      shipmentRow("s1", { customer: "Alpha" }),
      shipmentRow("s2", { customer: "Alpha" }),
      shipmentRow("s3", { customer: "Beta" }),
    ]);
    const r = await runControlTowerReport({
      tenantId: "t1",
      ctx: portalCtx,
      actorUserId: "a1",
      configInput: {
        dimension: "customer",
        measure: "shipments",
        topN: 1,
      },
    });
    expect(r.fullSeriesRows).toHaveLength(2);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.label).toBe("Alpha");
    expect(r.rows[0]!.metrics.shipments).toBe(2);
    expect(r.coverage.dimensionGroupsTotal).toBe(2);
    expect(r.coverage.dimensionGroupsShown).toBe(1);
  });

  it("rolls exceptionCatalog dimension from open exceptions and loads codes", async () => {
    findManyExceptionCodes.mockResolvedValueOnce([
      { code: "LATE_DOC", label: "Late documentation" },
    ]);
    findManyShipments.mockResolvedValueOnce([
      shipmentRow("s1", {
        ctExceptions: [{ type: "late_doc" }, { type: "late_doc" }],
      }),
    ]);
    const r = await runControlTowerReport({
      tenantId: "t1",
      ctx: portalCtx,
      actorUserId: "a1",
      configInput: { dimension: "exceptionCatalog", measure: "shipments" },
    });
    expect(findManyExceptionCodes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", isActive: true },
      }),
    );
    expect(r.config.measure).toBe("openExceptions");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.key).toBe("LATE_DOC");
    expect(r.rows[0]!.metrics.openExceptions).toBe(2);
    expect(r.rows[0]!.metrics.shipments).toBe(0);
  });

  it("loads display currency preference when actorUserId is set", async () => {
    findManyShipments.mockResolvedValueOnce([shipmentRow("s1")]);
    findUniquePref.mockResolvedValueOnce({
      value: { currency: "EUR" },
    });
    await runControlTowerReport({
      tenantId: "t1",
      ctx: portalCtx,
      configInput: { dimension: "month", measure: "shipments" },
      actorUserId: "user-1",
    });
    expect(findUniquePref).toHaveBeenCalledWith({
      where: { userId_key: { userId: "user-1", key: "controlTower.displayCurrency" } },
      select: { value: true },
    });
  });

  it("requests FX rates when cost lines use a different currency than display", async () => {
    findManyShipments.mockResolvedValueOnce([
      shipmentRow("s1", {
        ctCostLines: [{ amountMinor: BigInt(10000), currency: "EUR" }],
      }),
    ]);
    findUniquePref.mockResolvedValueOnce({
      value: { currency: "USD" },
    });
    await runControlTowerReport({
      tenantId: "t1",
      ctx: portalCtx,
      configInput: { dimension: "month", measure: "shippingSpend" },
      actorUserId: "user-1",
    });
    expect(findManyFx).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
        }),
      }),
    );
  });
});
