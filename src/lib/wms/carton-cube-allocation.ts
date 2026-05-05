import {
  crossDockStagingFirstCmp,
  orderPickSlotsMinBinTouches,
  orderPickSlotsMinBinTouchesReservePickFace,
  type WavePickSlot,
} from "./allocation-strategy";

/** Optional master-carton + BF-89 hints from `Product` (BF-33 / BF-89). */
export type ProductCartonCubeHints = {
  cartonLengthMm: number | null;
  cartonWidthMm: number | null;
  cartonHeightMm: number | null;
  cartonUnitsPerMasterCarton: unknown;
  /** BF-89 — cm³ per each (stored on Product); used when master carton dims do not resolve a cube. */
  wmsUnitCubeCm3Bf89?: unknown;
};

export type PickCubeEstimateBf89 = {
  cubeMm3: number | null;
  source: "master_carton" | "unit_bf89" | "none";
};

/** BF-89 — combine warehouse wave unit cap with optional per-SKU pick slice size (min of positives). */
export function effectivePickCartonCapBf89(
  warehouseCartonCap: number | null | undefined,
  productCartonUnitsBf89: unknown,
): number | null {
  const wh =
    warehouseCartonCap != null && Number.isFinite(warehouseCartonCap) && warehouseCartonCap > 0
      ? warehouseCartonCap
      : null;
  const puRaw = productCartonUnitsBf89;
  const pu = puRaw != null ? Number(puRaw as number | string) : NaN;
  const pOk = Number.isFinite(pu) && pu > 0 ? pu : null;
  if (wh == null && pOk == null) return null;
  if (wh != null && pOk != null) return Math.min(wh, pOk);
  return wh ?? pOk;
}

/**
 * BF-89 — pick cube estimate: master carton heuristic first, else `remainingQty × unitCubeCm3 × 1000` mm³.
 */
export function estimatePickCubeMm3Bf89(
  remainingQty: number,
  hints: ProductCartonCubeHints | null | undefined,
): PickCubeEstimateBf89 {
  const master = estimatePickCubeMm3(remainingQty, hints);
  if (master != null) return { cubeMm3: master, source: "master_carton" };
  const R = Math.max(0, remainingQty);
  if (R <= 0) return { cubeMm3: null, source: "none" };
  const ucRaw = hints?.wmsUnitCubeCm3Bf89;
  const uc = ucRaw != null ? Number(ucRaw as number | string) : NaN;
  if (!Number.isFinite(uc) || uc <= 0) return { cubeMm3: null, source: "none" };
  return { cubeMm3: R * uc * 1000, source: "unit_bf89" };
}

export function computeCartonCubeMm3(
  lengthMm: number | null | undefined,
  widthMm: number | null | undefined,
  heightMm: number | null | undefined,
): number | null {
  if (
    lengthMm == null ||
    widthMm == null ||
    heightMm == null ||
    !Number.isFinite(lengthMm) ||
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm)
  ) {
    return null;
  }
  const L = Math.trunc(lengthMm);
  const W = Math.trunc(widthMm);
  const H = Math.trunc(heightMm);
  if (L <= 0 || W <= 0 || H <= 0) return null;
  return L * W * H;
}

/**
 * Estimated cubic mm for the pick slice of `remainingQty`, using master-carton cube × ceil(qty / units-per-carton).
 * Returns null when carton dims are incomplete or remainder is non-positive.
 */
export function estimatePickCubeMm3(
  remainingQty: number,
  hints: ProductCartonCubeHints | null | undefined,
): number | null {
  const cube = computeCartonCubeMm3(
    hints?.cartonLengthMm ?? null,
    hints?.cartonWidthMm ?? null,
    hints?.cartonHeightMm ?? null,
  );
  if (cube == null) return null;
  const R = Math.max(0, remainingQty);
  if (R <= 0) return null;
  let units = 1;
  if (hints?.cartonUnitsPerMasterCarton != null) {
    const u = Number(hints.cartonUnitsPerMasterCarton as number | string);
    if (Number.isFinite(u) && u > 0) units = u;
  }
  const cartons = Math.ceil(R / units);
  return cartons * cube;
}

/**
 * When pick cube and bin capacity are both known, bins that cannot fit the estimated pick cube sort last.
 * Otherwise tier 0 (no penalty).
 */
export function binCubeInsufficientTier(
  pickCubeMm3: number | null,
  binCapacityCubeMm3: number | null | undefined,
): number {
  if (pickCubeMm3 == null || pickCubeMm3 <= 0) return 0;
  if (binCapacityCubeMm3 == null || binCapacityCubeMm3 <= 0) return 0;
  return pickCubeMm3 > binCapacityCubeMm3 ? 1 : 0;
}

function pickFaceRank(isPickFace: boolean): number {
  return isPickFace ? 1 : 0;
}

/** BF-33 — BF-15 greedy ordering with cube-feasibility tier when hints resolve to a pick cube estimate. */
export function orderPickSlotsMinBinTouchesCubeAware(
  slots: WavePickSlot[],
  lineRemainingQty: number,
  product: ProductCartonCubeHints | null | undefined,
): WavePickSlot[] {
  const pickCube = estimatePickCubeMm3Bf89(lineRemainingQty, product).cubeMm3;
  if (pickCube == null) {
    return orderPickSlotsMinBinTouches(slots, lineRemainingQty);
  }
  const copy = slots.map((s) => ({ ...s }));
  const R = Math.max(0, lineRemainingQty);
  if (R <= 0) return copy;
  copy.sort((a, b) => {
    const tierA = binCubeInsufficientTier(pickCube, a.binCapacityCubeMm3);
    const tierB = binCubeInsufficientTier(pickCube, b.binCapacityCubeMm3);
    if (tierA !== tierB) return tierA - tierB;
    const xd = crossDockStagingFirstCmp(a, b);
    if (xd !== 0) return xd;

    const aFull = a.available >= R ? 1 : 0;
    const bFull = b.available >= R ? 1 : 0;
    if (aFull !== bFull) return bFull - aFull;
    if (aFull === 1) {
      return (
        a.available - b.available ||
        a.binCode.localeCompare(b.binCode) ||
        a.binId.localeCompare(b.binId)
      );
    }
    return (
      b.available - a.available ||
      a.binCode.localeCompare(b.binCode) ||
      a.binId.localeCompare(b.binId)
    );
  });
  return copy;
}

/** BF-33 — BF-23 greedy ordering with the same cube-feasibility tier ahead of pick-face reserve. */
export function orderPickSlotsMinBinTouchesReservePickFaceCubeAware(
  slots: WavePickSlot[],
  lineRemainingQty: number,
  product: ProductCartonCubeHints | null | undefined,
): WavePickSlot[] {
  const pickCube = estimatePickCubeMm3Bf89(lineRemainingQty, product).cubeMm3;
  if (pickCube == null) {
    return orderPickSlotsMinBinTouchesReservePickFace(slots, lineRemainingQty);
  }
  const copy = slots.map((s) => ({ ...s }));
  const R = Math.max(0, lineRemainingQty);
  if (R <= 0) return copy;
  copy.sort((a, b) => {
    const tierA = binCubeInsufficientTier(pickCube, a.binCapacityCubeMm3);
    const tierB = binCubeInsufficientTier(pickCube, b.binCapacityCubeMm3);
    if (tierA !== tierB) return tierA - tierB;
    const xd = crossDockStagingFirstCmp(a, b);
    if (xd !== 0) return xd;

    const aFull = a.available >= R ? 1 : 0;
    const bFull = b.available >= R ? 1 : 0;
    if (aFull !== bFull) return bFull - aFull;
    if (aFull === 1) {
      const byAvail = a.available - b.available;
      if (byAvail !== 0) return byAvail;
      const face = pickFaceRank(a.isPickFace) - pickFaceRank(b.isPickFace);
      if (face !== 0) return face;
      return a.binCode.localeCompare(b.binCode) || a.binId.localeCompare(b.binId);
    }
    const byAvailDesc = b.available - a.available;
    if (byAvailDesc !== 0) return byAvailDesc;
    const face = pickFaceRank(a.isPickFace) - pickFaceRank(b.isPickFace);
    if (face !== 0) return face;
    return a.binCode.localeCompare(b.binCode) || a.binId.localeCompare(b.binId);
  });
  return copy;
}
