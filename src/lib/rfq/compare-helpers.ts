export function summarizeJsonArray(json: unknown, maxItems = 5): string {
  if (json == null) return "—";
  if (!Array.isArray(json)) return truncate(String(json), 140);
  if (json.length === 0) return "None";
  const parts = json.slice(0, maxItems).map((item) => {
    if (item && typeof item === "object" && item !== null && "label" in item) {
      const label = (item as { label?: unknown }).label;
      const amount = (item as { amount?: unknown }).amount;
      if (typeof label === "string") {
        return amount != null && amount !== "" ? `${label} (${String(amount)})` : label;
      }
    }
    return truncate(JSON.stringify(item), 80);
  });
  const more = json.length > maxItems ? ` (+${json.length - maxItems} more)` : "";
  return parts.join("; ") + more;
}

export function summarizeFreeTime(json: unknown): string {
  if (json == null) return "—";
  if (typeof json !== "object" || Array.isArray(json)) return truncate(JSON.stringify(json), 160);
  const o = json as Record<string, unknown>;
  const bits: string[] = [];
  if (typeof o.demurrageDays === "number") bits.push(`Demurrage ${o.demurrageDays}d`);
  if (typeof o.detentionDays === "number") bits.push(`Detention ${o.detentionDays}d`);
  if (typeof o.combinedLabel === "string" && o.combinedLabel) bits.push(String(o.combinedLabel));
  if (typeof o.notes === "string" && o.notes) bits.push(String(o.notes));
  return bits.length ? bits.join(" · ") : truncate(JSON.stringify(json), 160);
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
