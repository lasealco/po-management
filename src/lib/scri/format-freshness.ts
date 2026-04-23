/** Human-readable age for feed cards (uses wall-clock skew vs `now`). */
export function formatScriFreshness(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMin = Math.max(0, Math.round((nowMs - t) / 60_000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
