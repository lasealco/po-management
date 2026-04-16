/** Summarise Control Tower tracking milestones for Shipment 360 / workbench (KPI-style roll-up). */

export type CtMilestoneSummaryInput = {
  code: string;
  label: string | null;
  plannedAt: string | null;
  predictedAt: string | null;
  actualAt: string | null;
};

export type CtMilestoneSummary = {
  openCount: number;
  lateCount: number;
  next: null | {
    code: string;
    label: string | null;
    dueAt: string | null;
    isLate: boolean;
  };
};

function dueMs(row: CtMilestoneSummaryInput): number | null {
  const raw = row.plannedAt ?? row.predictedAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

function sortKey(row: CtMilestoneSummaryInput): number {
  return dueMs(row) ?? Number.POSITIVE_INFINITY;
}

export function computeCtMilestoneSummary(
  rows: CtMilestoneSummaryInput[],
  now: Date = new Date(),
): CtMilestoneSummary {
  const open = rows.filter((r) => !r.actualAt);
  const nowMs = now.getTime();
  const lateCount = open.filter((r) => {
    const t = dueMs(r);
    return t != null && t < nowMs;
  }).length;
  const sorted = [...open].sort((a, b) => sortKey(a) - sortKey(b));
  const next = sorted[0];
  if (!next) {
    return { openCount: open.length, lateCount, next: null };
  }
  const dueAt = next.plannedAt ?? next.predictedAt;
  const t = dueAt ? new Date(dueAt).getTime() : NaN;
  const isLate = !Number.isNaN(t) && t < nowMs;
  return {
    openCount: open.length,
    lateCount,
    next: {
      code: next.code,
      label: next.label,
      dueAt: dueAt ?? null,
      isLate,
    },
  };
}
