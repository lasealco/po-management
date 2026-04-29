/** Normalize dock identifier for consistent matching (overlap checks). */
export function normalizeDockCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 64);
}

/** Strict overlap test for half-open intervals is ambiguous; we use closed-window semantics matching DB comparisons: overlap iff startA < endB && endA > startB */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}
