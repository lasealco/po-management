import { crossDockStagingFirstCmp, type WavePickSlot } from "./allocation-strategy";
import {
  orderPickSlotsMinBinTouches,
  orderPickSlotsMinBinTouchesReservePickFace,
} from "./allocation-strategy";

/**
 * Max distinct balance rows (bin × lot bucket) considered for **exact** minimal-cardinality subset search.
 * Beyond this, the prototype falls back to BF-15 / BF-23 greedy on the full slot list (still deterministic).
 */
export const SOLVER_PROTOTYPE_MAX_SLOTS_FOR_EXACT = 14;

function slotLexKey(a: WavePickSlot): string {
  return `${a.binCode}\t${a.binId}\t${a.lotCode}`;
}

/** Advancing `comb` (sorted indices, length k) to the next lexicographic k-subset of `{0..n-1}`; returns false when done. */
export function nextCombination(comb: number[], n: number): boolean {
  const k = comb.length;
  let i = k - 1;
  while (i >= 0 && comb[i] === n - k + i) i--;
  if (i < 0) return false;
  comb[i] += 1;
  for (let j = i + 1; j < k; j += 1) comb[j] = comb[j - 1] + 1;
  return true;
}

/**
 * Smallest k such that some k slots sum to ≥ R; ties broken by **lexicographic index tuple** on slots sorted by
 * `(binCode, binId, lotCode)` — deterministic “golden file” behavior.
 */
export function findMinimalFeasibleSlotSubset(slots: WavePickSlot[], R: number): WavePickSlot[] | null {
  const target = Math.max(0, R);
  if (target <= 0) return [];
  const viable = slots.filter((s) => s.available > 0);
  const sorted = [...viable].sort((a, b) => {
    const xd = crossDockStagingFirstCmp(a, b);
    if (xd !== 0) return xd;
    return slotLexKey(a).localeCompare(slotLexKey(b));
  });
  const n = sorted.length;
  let sumAll = 0;
  for (const s of sorted) sumAll += s.available;
  if (sumAll < target) return null;

  for (let k = 1; k <= n; k += 1) {
    const comb = Array.from({ length: k }, (_, i) => i);
    while (true) {
      let partial = 0;
      for (const idx of comb) partial += sorted[idx]!.available;
      if (partial >= target) {
        return comb.map((idx) => sorted[idx]!);
      }
      if (!nextCombination(comb, n)) break;
    }
  }
  return null;
}

export type SolverPrototypeMode = "BF15" | "BF23_RESERVE_PICK_FACE";

/**
 * BF-34 — Enumerates minimal **slot** cardinality to cover remainder (exact when ≤ {@link SOLVER_PROTOTYPE_MAX_SLOTS_FOR_EXACT}),
 * then runs BF-15 or BF-23 **only on that subset**. Falls back to greedy on all slots when enumeration is skipped or infeasible.
 */
export function orderPickSlotsSolverPrototype(
  slots: WavePickSlot[],
  remainingQty: number,
  mode: SolverPrototypeMode,
): WavePickSlot[] {
  const R = Math.max(0, remainingQty);
  const positive = slots.filter((s) => s.available > 0);
  if (R <= 0 || positive.length === 0) {
    return mode === "BF23_RESERVE_PICK_FACE"
      ? orderPickSlotsMinBinTouchesReservePickFace(slots, R)
      : orderPickSlotsMinBinTouches(slots, R);
  }

  const useExact = positive.length <= SOLVER_PROTOTYPE_MAX_SLOTS_FOR_EXACT;
  const subset = useExact ? findMinimalFeasibleSlotSubset(positive, R) : null;
  const basis = subset != null && subset.length > 0 ? subset : positive;

  return mode === "BF23_RESERVE_PICK_FACE"
    ? orderPickSlotsMinBinTouchesReservePickFace(basis, R)
    : orderPickSlotsMinBinTouches(basis, R);
}
