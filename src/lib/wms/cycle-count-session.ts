import type { Prisma } from "@prisma/client";

/** BF-51 — supervisor-facing reason codes when physical count ≠ frozen expected qty. */
export const WMS_CYCLE_COUNT_VARIANCE_REASON_CODES = [
  "SHRINK",
  "DAMAGE",
  "DATA_ENTRY",
  "FOUND",
  "OTHER",
] as const;

export type WmsCycleCountVarianceReasonCode = (typeof WMS_CYCLE_COUNT_VARIANCE_REASON_CODES)[number];

const REASON_SET = new Set<string>(WMS_CYCLE_COUNT_VARIANCE_REASON_CODES);

export function isWmsCycleCountVarianceReasonCode(code: string): code is WmsCycleCountVarianceReasonCode {
  return REASON_SET.has(code);
}

/** Normalize operator input to uppercase token or null when empty. */
export function normalizeCycleCountVarianceReasonCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim().toUpperCase();
  return t.length ? t : null;
}

/** Parse non-negative decimal qty from JSON body (number or numeric string). */
export function parseCycleCountQty(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function cycleCountQtyVariance(expected: number, counted: number): number {
  return counted - expected;
}

export function varianceRequiresReason(expected: number, counted: number): boolean {
  return cycleCountQtyVariance(expected, counted) !== 0;
}

export async function allocateUniqueCycleCountReferenceCode(
  tx: Prisma.TransactionClient,
): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const referenceCode = `CC-${suffix}`;
    const clash = await tx.wmsCycleCountSession.findUnique({
      where: { referenceCode },
      select: { id: true },
    });
    if (!clash) return referenceCode;
  }
  throw new Error("cycle_count_reference_alloc_failed");
}

export function truncateCycleCountNote(raw: string | null | undefined, max = 500): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t.length) return null;
  return t.length > max ? t.slice(0, max) : t;
}
