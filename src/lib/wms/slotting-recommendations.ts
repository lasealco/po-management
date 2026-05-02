import type { BinStorageType, PrismaClient } from "@prisma/client";

/** Pareto on pick-unit volume: cumulative share ≤ aPct → A, then ≤ bPct → B, else C. */
export const DEFAULT_ABC_THRESHOLDS = { aCumulativePct: 80, bCumulativePct: 95 } as const;

export type AbcClass = "A" | "B" | "C";

export type SlottingReasonCode = "A_SKU_OFF_PICK_FACE" | "B_SKU_OFF_PICK_FACE" | "C_SKU_ON_PICK_FACE";

export function assignAbcByPickVolume(
  productPickQty: Map<string, number>,
  thresholds = DEFAULT_ABC_THRESHOLDS,
): Map<string, AbcClass> {
  const out = new Map<string, AbcClass>();
  const entries = [...productPickQty.entries()].filter(([, q]) => q > 0);
  entries.sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, q]) => s + q, 0);
  if (total <= 0) return out;

  const aFrac = thresholds.aCumulativePct / 100;
  const bFrac = thresholds.bCumulativePct / 100;
  let cumBefore = 0;
  for (const [pid, q] of entries) {
    const share = cumBefore / total;
    const cls: AbcClass =
      share < aFrac ? "A" : share < bFrac ? "B" : "C";
    out.set(pid, cls);
    cumBefore += q;
  }

  return out;
}

function priorityFor(reason: SlottingReasonCode): number {
  switch (reason) {
    case "A_SKU_OFF_PICK_FACE":
      return 100;
    case "B_SKU_OFF_PICK_FACE":
      return 60;
    case "C_SKU_ON_PICK_FACE":
      return 35;
    default:
      return 0;
  }
}

export type SlottingRecommendationRow = {
  priorityScore: number;
  reasonCode: SlottingReasonCode;
  abcClass: AbcClass;
  productPickVolume: number;
  inventoryBalanceId: string;
  lotCode: string;
  onHandQty: string;
  product: {
    id: string;
    productCode: string | null;
    sku: string | null;
    name: string;
  };
  currentBin: {
    id: string;
    code: string;
    isPickFace: boolean;
    storageType: BinStorageType;
  };
  suggestedBin: {
    id: string;
    code: string;
    isPickFace: boolean;
    storageType: BinStorageType;
  } | null;
};

export type SlottingRecommendationsResult = {
  warehouse: { id: string; code: string | null; name: string };
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  methodology: string;
  abcThresholds: typeof DEFAULT_ABC_THRESHOLDS;
  summary: {
    balancesScanned: number;
    recommendationCount: number;
    pickFaceBins: number;
    bulkCandidateBins: number;
    productsWithPicks: number;
  };
  warnings: string[];
  recommendations: SlottingRecommendationRow[];
};

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function slottingRecommendationsToCsv(rows: SlottingRecommendationRow[]): string {
  const header = [
    "priorityScore",
    "reasonCode",
    "abcClass",
    "productPickVolume",
    "productCode",
    "sku",
    "productName",
    "lotCode",
    "onHandQty",
    "currentBinCode",
    "currentPickFace",
    "currentStorageType",
    "suggestedBinCode",
    "suggestedPickFace",
    "suggestedStorageType",
  ].join(",");
  const lines = rows.map((r) =>
    [
      String(r.priorityScore),
      r.reasonCode,
      r.abcClass,
      String(r.productPickVolume),
      csvEscape(r.product.productCode ?? ""),
      csvEscape(r.product.sku ?? ""),
      csvEscape(r.product.name),
      csvEscape(r.lotCode),
      csvEscape(r.onHandQty),
      csvEscape(r.currentBin.code),
      r.currentBin.isPickFace ? "1" : "0",
      r.currentBin.storageType,
      r.suggestedBin ? csvEscape(r.suggestedBin.code) : "",
      r.suggestedBin ? (r.suggestedBin.isPickFace ? "1" : "0") : "",
      r.suggestedBin ? r.suggestedBin.storageType : "",
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

export async function buildSlottingRecommendations(
  prisma: PrismaClient,
  tenantId: string,
  warehouseId: string,
  windowDays: number,
): Promise<SlottingRecommendationsResult | null> {
  const wh = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenantId },
    select: { id: true, code: true, name: true },
  });
  if (!wh) return null;

  const days = Math.max(1, Math.min(365, Math.floor(windowDays)));
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 86_400_000);

  const moveAgg = await prisma.inventoryMovement.groupBy({
    by: ["productId"],
    where: {
      tenantId,
      warehouseId,
      movementType: "PICK",
      createdAt: { gte: windowStart },
    },
    _sum: { quantity: true },
  });

  const productPickQty = new Map<string, number>();
  for (const row of moveAgg) {
    const raw = row._sum.quantity;
    const n = raw == null ? 0 : Math.abs(Number(raw));
    if (n > 0) productPickQty.set(row.productId, n);
  }

  const abcByProduct = assignAbcByPickVolume(productPickQty, DEFAULT_ABC_THRESHOLDS);

  const pickFaceBins = await prisma.warehouseBin.findMany({
    where: {
      warehouseId,
      isActive: true,
      isPickFace: true,
      storageType: { not: "QUARANTINE" },
    },
    select: { id: true, code: true, isPickFace: true, storageType: true },
    orderBy: { code: "asc" },
  });

  const bulkBins = await prisma.warehouseBin.findMany({
    where: {
      warehouseId,
      isActive: true,
      isPickFace: false,
      storageType: { in: ["PALLET", "FLOOR"] },
    },
    select: { id: true, code: true, isPickFace: true, storageType: true },
    orderBy: { code: "asc" },
  });

  const allCandidateBinIds = [...pickFaceBins.map((b) => b.id), ...bulkBins.map((b) => b.id)];
  const occupancy =
    allCandidateBinIds.length === 0
      ? []
      : await prisma.inventoryBalance.groupBy({
          by: ["binId"],
          where: {
            warehouseId,
            binId: { in: allCandidateBinIds },
            onHandQty: { gt: 0 },
          },
          _count: { id: true },
        });
  const balanceRowsByBin = new Map<string, number>();
  for (const o of occupancy) {
    balanceRowsByBin.set(o.binId, o._count.id);
  }

  function lightestPickFace(excludeBinId: string) {
    const candidates = pickFaceBins.filter((b) => b.id !== excludeBinId);
    if (candidates.length === 0) return null;
    let best = candidates[0]!;
    let bestN = balanceRowsByBin.get(best.id) ?? 0;
    for (const b of candidates.slice(1)) {
      const n = balanceRowsByBin.get(b.id) ?? 0;
      if (n < bestN || (n === bestN && b.code.localeCompare(best.code) < 0)) {
        best = b;
        bestN = n;
      }
    }
    return best;
  }

  function lightestBulk(excludeBinId: string) {
    const candidates = bulkBins.filter((b) => b.id !== excludeBinId);
    if (candidates.length === 0) return null;
    let best = candidates[0]!;
    let bestN = balanceRowsByBin.get(best.id) ?? 0;
    for (const b of candidates.slice(1)) {
      const n = balanceRowsByBin.get(b.id) ?? 0;
      if (n < bestN || (n === bestN && b.code.localeCompare(best.code) < 0)) {
        best = b;
        bestN = n;
      }
    }
    return best;
  }

  const balances = await prisma.inventoryBalance.findMany({
    where: {
      tenantId,
      warehouseId,
      onHandQty: { gt: 0 },
    },
    include: {
      bin: { select: { id: true, code: true, isPickFace: true, storageType: true, isActive: true } },
      product: { select: { id: true, productCode: true, sku: true, name: true } },
    },
  });

  const warnings: string[] = [];
  if (pickFaceBins.length === 0) {
    warnings.push("No active pick-face bins (excluding quarantine) — cannot suggest pick-face targets.");
  }
  if (bulkBins.length === 0) {
    warnings.push("No active PALLET/FLOOR bulk bins — cannot suggest bulk relocation targets.");
  }

  const recommendations: SlottingRecommendationRow[] = [];

  for (const bal of balances) {
    const bin = bal.bin;
    if (!bin.isActive) continue;
    if (bin.storageType === "QUARANTINE") continue;

    const abc: AbcClass = abcByProduct.get(bal.productId) ?? "C";
    const vol = productPickQty.get(bal.productId) ?? 0;

    let reason: SlottingReasonCode | null = null;
    if ((abc === "A" || abc === "B") && !bin.isPickFace) {
      reason = abc === "A" ? "A_SKU_OFF_PICK_FACE" : "B_SKU_OFF_PICK_FACE";
    } else if (abc === "C" && bin.isPickFace && bin.storageType !== "STAGING") {
      reason = "C_SKU_ON_PICK_FACE";
    }
    if (!reason) continue;

    const suggestedBin =
      reason === "C_SKU_ON_PICK_FACE" ? lightestBulk(bin.id) : lightestPickFace(bin.id);

    recommendations.push({
      priorityScore: priorityFor(reason) + Math.min(20, Math.floor(vol / 100)),
      reasonCode: reason,
      abcClass: abc,
      productPickVolume: vol,
      inventoryBalanceId: bal.id,
      lotCode: bal.lotCode,
      onHandQty: String(bal.onHandQty),
      product: {
        id: bal.product.id,
        productCode: bal.product.productCode,
        sku: bal.product.sku,
        name: bal.product.name,
      },
      currentBin: {
        id: bin.id,
        code: bin.code,
        isPickFace: bin.isPickFace,
        storageType: bin.storageType,
      },
      suggestedBin: suggestedBin
        ? {
            id: suggestedBin.id,
            code: suggestedBin.code,
            isPickFace: suggestedBin.isPickFace,
            storageType: suggestedBin.storageType,
          }
        : null,
    });
  }

  recommendations.sort((a, b) => b.priorityScore - a.priorityScore || a.currentBin.code.localeCompare(b.currentBin.code));

  return {
    warehouse: wh,
    windowDays: days,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    methodology:
      "ABC from cumulative outbound pick-unit volume (|PICK sum| per SKU) in window; A/B SKUs off reserve pick-face suggest pick-face bins with lightest balance-row load; C SKUs suggest PALLET/FLOOR bulk away from pick-face.",
    abcThresholds: DEFAULT_ABC_THRESHOLDS,
    summary: {
      balancesScanned: balances.length,
      recommendationCount: recommendations.length,
      pickFaceBins: pickFaceBins.length,
      bulkCandidateBins: bulkBins.length,
      productsWithPicks: productPickQty.size,
    },
    warnings,
    recommendations,
  };
}
