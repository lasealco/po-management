/**
 * BF-86 — bin × velocity / cube utilization snapshot (read-only advisory JSON).
 * See docs/wms/WMS_CAPACITY_UTILIZATION_BF86.md.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

import type { WmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const BF86_SCHEMA_VERSION = "bf86.v1" as const;

export type ParsedCapacityUtilizationSnapshotQueryBf86 = {
  warehouseId: string;
  windowDays: number;
  /** Returned bins cap (sorted cohort). */
  limitBins: number;
  /** Primary sort before cap; utilization prefers cube ratio then velocity. */
  sort: "velocity_desc" | "utilization_desc";
};

export type CapacityUtilizationBinBf86 = {
  binId: string;
  binCode: string;
  zoneCode: string | null;
  storageType: string;
  isPickFace: boolean;
  capacityCubeCubicMm: number | null;
  balanceRowCount: number;
  onHandQtyTotal: string;
  allocatedQtyTotal: string;
  /** Sum of carton-cube estimates when product carton dims + units/master known; null when empty bin / unknown dims only. */
  estimatedOccupiedCubeMm: number | null;
  /** Occupied ÷ capacity when both known (may exceed 1 when overstuffed vs heuristic capacity). */
  cubeUtilizationRatio: number | null;
  /** Absolute outbound pick units in window (|sum qty| per BIN-linked PICK movement rows). */
  pickVelocityUnits: number;
  /** 0–100 vs strongest picker bin in the returned cohort (not warehouse-global). */
  velocityHeatScore: number;
};

export type CapacityUtilizationSnapshotBf86 = {
  schemaVersion: typeof BF86_SCHEMA_VERSION;
  generatedAt: string;
  methodology: string;
  warehouse: { id: string; code: string | null; name: string };
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  sort: ParsedCapacityUtilizationSnapshotQueryBf86["sort"];
  cap: { requestedMaxBins: number; returnedBins: number; binsInWarehouseActive: number };
  warnings: string[];
  bins: CapacityUtilizationBinBf86[];
};

export function parseCapacityUtilizationSnapshotQueryBf86(
  params: URLSearchParams,
): { ok: true; value: ParsedCapacityUtilizationSnapshotQueryBf86 } | { ok: false; error: string } {
  const warehouseId = (params.get("warehouseId") ?? params.get("wh") ?? "").trim();
  if (!warehouseId) {
    return { ok: false, error: "warehouseId (or wh) query parameter required." };
  }

  const daysRaw = params.get("days") ?? params.get("windowDays");
  const daysParsed = daysRaw != null ? Number(daysRaw) : 30;
  const windowDays = Number.isFinite(daysParsed)
    ? Math.min(365, Math.max(1, Math.floor(daysParsed)))
    : 30;

  const limitRaw = params.get("limitBins") ?? params.get("limit");
  const limitParsed = limitRaw != null ? Number(limitRaw) : 200;
  const limitBins = Number.isFinite(limitParsed)
    ? Math.min(500, Math.max(1, Math.floor(limitParsed)))
    : 200;

  const sortRaw = (params.get("sort") ?? "velocity_desc").trim().toLowerCase();
  const sort =
    sortRaw === "utilization" || sortRaw === "utilization_desc"
      ? "utilization_desc"
      : "velocity_desc";

  return {
    ok: true,
    value: { warehouseId, windowDays, limitBins, sort },
  };
}

/** Per balance row: estimated cubic mm from master carton cube × carton count when dims + units/master known. */
export function estimateBalanceOccupiedCubeMmBf86(input: {
  onHandQty: Prisma.Decimal;
  cartonLengthMm: number | null;
  cartonWidthMm: number | null;
  cartonHeightMm: number | null;
  cartonUnitsPerMasterCarton: Prisma.Decimal | null;
}): number | null {
  const L = input.cartonLengthMm;
  const W = input.cartonWidthMm;
  const H = input.cartonHeightMm;
  if (L == null || W == null || H == null || L <= 0 || W <= 0 || H <= 0) return null;
  const unitsRaw = input.cartonUnitsPerMasterCarton;
  const units = unitsRaw == null ? null : Number(unitsRaw);
  if (units == null || !Number.isFinite(units) || units <= 0) return null;
  const qty = Number(input.onHandQty);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const cartons = qty / units;
  return cartons * L * W * H;
}

export async function loadCapacityUtilizationSnapshotBf86(
  prisma: PrismaClient,
  tenantId: string,
  viewScope: WmsViewReadScope,
  q: ParsedCapacityUtilizationSnapshotQueryBf86,
): Promise<CapacityUtilizationSnapshotBf86 | null> {
  const wh = await prisma.warehouse.findFirst({
    where: { id: q.warehouseId, tenantId },
    select: { id: true, code: true, name: true },
  });
  if (!wh) return null;

  const productScope = viewScope.inventoryProduct;
  const balanceProductWhere: Prisma.InventoryBalanceWhereInput | undefined = productScope
    ? { product: productScope }
    : undefined;
  const movementProductWhere: Prisma.InventoryMovementWhereInput | undefined = productScope
    ? { product: productScope }
    : undefined;

  const days = q.windowDays;
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 86_400_000);

  const binsRaw = await prisma.warehouseBin.findMany({
    where: { tenantId, warehouseId: q.warehouseId, isActive: true },
    select: {
      id: true,
      code: true,
      storageType: true,
      isPickFace: true,
      capacityCubeCubicMm: true,
      zone: { select: { code: true } },
    },
    orderBy: { code: "asc" },
  });

  const balanceWhere: Prisma.InventoryBalanceWhereInput = {
    tenantId,
    warehouseId: q.warehouseId,
    onHandQty: { gt: 0 },
    ...(balanceProductWhere ?? {}),
  };

  const balances = await prisma.inventoryBalance.findMany({
    where: balanceWhere,
    select: {
      binId: true,
      onHandQty: true,
      allocatedQty: true,
      product: {
        select: {
          cartonLengthMm: true,
          cartonWidthMm: true,
          cartonHeightMm: true,
          cartonUnitsPerMasterCarton: true,
        },
      },
    },
  });

  const pickAgg = await prisma.inventoryMovement.groupBy({
    by: ["binId"],
    where: {
      tenantId,
      warehouseId: q.warehouseId,
      movementType: "PICK",
      createdAt: { gte: windowStart },
      binId: { not: null },
      ...(movementProductWhere ?? {}),
    },
    _sum: { quantity: true },
  });

  const picksByBin = new Map<string, number>();
  for (const row of pickAgg) {
    if (!row.binId) continue;
    const raw = row._sum.quantity;
    const n = raw == null ? 0 : Math.abs(Number(raw));
    picksByBin.set(row.binId, n);
  }

  type BinAgg = {
    balanceRowCount: number;
    onHandSum: number;
    allocatedSum: number;
    occupiedCubeSum: number;
    occupiedCubeKnownParts: number;
  };

  const aggs = new Map<string, BinAgg>();

  function ensureAgg(binId: string): BinAgg {
    let a = aggs.get(binId);
    if (!a) {
      a = {
        balanceRowCount: 0,
        onHandSum: 0,
        allocatedSum: 0,
        occupiedCubeSum: 0,
        occupiedCubeKnownParts: 0,
      };
      aggs.set(binId, a);
    }
    return a;
  }

  for (const b of balances) {
    const a = ensureAgg(b.binId);
    a.balanceRowCount += 1;
    a.onHandSum += Number(b.onHandQty);
    a.allocatedSum += Number(b.allocatedQty);
    const cube = estimateBalanceOccupiedCubeMmBf86({
      onHandQty: b.onHandQty,
      cartonLengthMm: b.product.cartonLengthMm,
      cartonWidthMm: b.product.cartonWidthMm,
      cartonHeightMm: b.product.cartonHeightMm,
      cartonUnitsPerMasterCarton: b.product.cartonUnitsPerMasterCarton,
    });
    if (cube != null && cube > 0) {
      a.occupiedCubeSum += cube;
      a.occupiedCubeKnownParts += 1;
    }
  }

  const warnings: string[] = [];
  const binsWithoutCapacity = binsRaw.filter((b) => b.capacityCubeCubicMm == null).length;
  if (binsWithoutCapacity > 0) {
    warnings.push(
      `${binsWithoutCapacity} active bins lack capacityCubeCubicMm — cube utilization ratio stays null for those rows.`,
    );
  }

  const rows: CapacityUtilizationBinBf86[] = binsRaw.map((bin) => {
    const agg = aggs.get(bin.id);
    const balanceRowCount = agg?.balanceRowCount ?? 0;
    const onHandQtyTotal = (agg?.onHandSum ?? 0).toFixed(3);
    const allocatedQtyTotal = (agg?.allocatedSum ?? 0).toFixed(3);
    const pickVelocityUnits = picksByBin.get(bin.id) ?? 0;

    let estimatedOccupiedCubeMm: number | null = null;
    if (agg && agg.occupiedCubeKnownParts > 0 && agg.occupiedCubeSum > 0) {
      estimatedOccupiedCubeMm = Math.round(agg.occupiedCubeSum);
    }

    const capMm = bin.capacityCubeCubicMm;
    let cubeUtilizationRatio: number | null = null;
    if (capMm != null && capMm > 0 && estimatedOccupiedCubeMm != null && estimatedOccupiedCubeMm > 0) {
      cubeUtilizationRatio = estimatedOccupiedCubeMm / capMm;
    }

    return {
      binId: bin.id,
      binCode: bin.code,
      zoneCode: bin.zone?.code ?? null,
      storageType: bin.storageType,
      isPickFace: bin.isPickFace,
      capacityCubeCubicMm: capMm,
      balanceRowCount,
      onHandQtyTotal,
      allocatedQtyTotal,
      estimatedOccupiedCubeMm,
      cubeUtilizationRatio,
      pickVelocityUnits,
      velocityHeatScore: 0,
    };
  });

  const sortVelocity = (a: CapacityUtilizationBinBf86, b: CapacityUtilizationBinBf86) =>
    b.pickVelocityUnits - a.pickVelocityUnits ||
    (b.cubeUtilizationRatio ?? -1) - (a.cubeUtilizationRatio ?? -1) ||
    a.binCode.localeCompare(b.binCode);

  const sortUtil = (a: CapacityUtilizationBinBf86, b: CapacityUtilizationBinBf86) => {
    const ar = a.cubeUtilizationRatio;
    const br = b.cubeUtilizationRatio;
    if (ar != null && br != null && ar !== br) return br - ar;
    if (ar != null && br == null) return -1;
    if (ar == null && br != null) return 1;
    return sortVelocity(a, b);
  };

  rows.sort(q.sort === "utilization_desc" ? sortUtil : sortVelocity);

  const capped = rows.slice(0, q.limitBins);
  const vmax = capped.reduce((m, r) => Math.max(m, r.pickVelocityUnits), 0);

  for (const r of capped) {
    r.velocityHeatScore =
      vmax <= 0 ? 0 : Math.min(100, Math.round((100 * r.pickVelocityUnits) / vmax));
  }

  return {
    schemaVersion: BF86_SCHEMA_VERSION,
    generatedAt: windowEnd.toISOString(),
    methodology:
      "BF-86 v1: per active bin — balance rows + on-hand/allocated totals from InventoryBalance; outbound pick velocity = sum of |quantity| on InventoryMovement rows with movementType=PICK and non-null binId in [windowStart, now]; occupied cube estimate sums sku rows where Product carton L/W/H mm and cartonUnitsPerMasterCarton yield master-carton cube × (onHandQty/units). Cube utilization = estimatedOccupiedCubeMm / WarehouseBin.capacityCubeCubicMm when both set. Cohort is truncated to limitBins after sorting.",
    warehouse: wh,
    windowDays: days,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    sort: q.sort,
    cap: {
      requestedMaxBins: q.limitBins,
      returnedBins: capped.length,
      binsInWarehouseActive: binsRaw.length,
    },
    warnings,
    bins: capped,
  };
}
