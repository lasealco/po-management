/**
 * Normalize ISO-type equipment strings for ocean FCL (best-effort).
 */
const EQ_COMPACT = /\b(20|40|45)(dv|hc|hq|nor|rf|rh|ot|fr|tk|gp|std|st)\b/gi;
const EQ_WORD = /\b(20|40|45)\s*(?:ft|')?\s*(std|st|dv|hc|hq|nor|reefer|rf|ot|fr|tk|gp)\b/gi;

export function normalizeEquipmentKey(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.replace(/\s+/g, "").toUpperCase();
  if (/^(20|40|45)(DV|HC|HQ|NOR|RF|RH|OT|FR|TK|GP|STD|ST)$/.test(t)) return t;
  const m = raw.match(EQ_COMPACT);
  if (m?.[0]) return m[0].replace(/\s+/g, "").toUpperCase();
  const w = raw.match(EQ_WORD);
  if (w?.[0]) {
    const x = w[0].toUpperCase().replace(/\s+/g, "").replace("REEFER", "RF").replace("STD", "DV").replace("ST", "DV");
    if (x.length >= 4) return x.slice(0, 5).replace(/^20DV$/, "20DV").replace(/^40DV$/, "40DV");
  }
  return t.length <= 8 ? t : t.slice(0, 8);
}

/** Parse 20/40/45 + type from free-text invoice description. */
export function parseEquipmentFromText(text: string): string | null {
  if (!text.trim()) return null;
  const fromLine = text.match(EQ_COMPACT);
  if (fromLine?.[0]) return normalizeEquipmentKey(fromLine[0]);
  const w = text.match(EQ_WORD);
  if (w?.[0]) return normalizeEquipmentKey(w[0]);
  return null;
}

export function equipmentMatches(invoiceEq: string | null, snapshotEq: string | null): "MATCH" | "NEUTRAL" | "MISMATCH" {
  const a = invoiceEq ? normalizeEquipmentKey(invoiceEq) : null;
  const b = snapshotEq ? normalizeEquipmentKey(snapshotEq) : null;
  if (!a || !b) return "NEUTRAL";
  if (a === b) return "MATCH";
  if (a.startsWith(b) || b.startsWith(a)) return "MATCH";
  const coreA = a.replace(/^(20|40|45)/, "$1");
  const coreB = b.replace(/^(20|40|45)/, "$1");
  if (coreA === coreB) return "MATCH";
  return "MISMATCH";
}
