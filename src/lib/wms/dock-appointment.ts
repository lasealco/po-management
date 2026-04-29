/** Normalize dock identifier for consistent matching (overlap checks). */
export function normalizeDockCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 64);
}

/** Strict overlap test for half-open intervals is ambiguous; we use closed-window semantics matching DB comparisons: overlap iff startA < endB && endA > startB */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** BF-05 — varchar caps aligned with Prisma `WmsDockAppointment` transport fields. */
export const DOCK_TRANSPORT_LIMITS = {
  carrierName: 120,
  carrierReference: 160,
  trailerId: 80,
} as const;

/** Trim / truncate optional carrier / trailer text; empty → null. */
export function truncateDockTransportField(raw: unknown, max: number): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.length <= max ? s : s.slice(0, max);
}

export type WmsDockYardMilestone = "GATE_IN" | "AT_DOCK" | "DEPARTED";

export function parseDockYardMilestone(raw: unknown): WmsDockYardMilestone | null {
  if (raw === "GATE_IN" || raw === "AT_DOCK" || raw === "DEPARTED") return raw;
  return null;
}
