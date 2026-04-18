/**
 * One-line summary of `snapshotMatchedJson` for tables and intake detail (not a full serializer).
 */
export function formatSnapshotMatchLabel(json: unknown): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "—";
  const j = json as Record<string, unknown>;
  if (typeof j.invoiceCurrency === "string" && Array.isArray(j.snapshotCurrencies)) {
    return `Currency mismatch (invoice ${j.invoiceCurrency})`;
  }
  if (typeof j.reason === "string" && j.reason === "EMPTY_POOL_AFTER_FILTERS") {
    const eq = typeof j.invoiceEquipment === "string" && j.invoiceEquipment.trim() ? j.invoiceEquipment.trim() : null;
    return eq ? `No eligible lines after filters (invoice equipment ${eq})` : "No eligible lines after filters";
  }
  if (typeof j.mode === "string" && j.reason === "NO_BASKET_COMPONENTS") {
    return `All-in: no basket built (${j.mode})`;
  }
  if (typeof j.mode === "string") {
    const exp = j.expectedAmount;
    if (j.mode === "CONTRACT_BREAKDOWN_GRAND" && (typeof exp === "number" || typeof exp === "string")) {
      return `All-in vs contract grand (${String(exp)})`;
    }
    if (j.mode === "CONTRACT_BASKET_SUM" && Array.isArray(j.components)) {
      return `All-in basket (${j.components.length} parts)`;
    }
    if (j.mode === "RFQ_ALL_IN_TOTAL") {
      return typeof exp === "number" || typeof exp === "string"
        ? `All-in vs RFQ total (${String(exp)})`
        : "All-in vs RFQ total";
    }
  }
  if (typeof j.label === "string" && j.label.trim()) {
    const k = typeof j.kind === "string" ? `${j.kind}: ` : "";
    return `${k}${j.label}`.slice(0, 96);
  }
  if (Array.isArray(j.ambiguousCandidates) && j.ambiguousCandidates.length > 0) {
    return `Ambiguous (${j.ambiguousCandidates.length} tied)`;
  }
  if (Array.isArray(j.topScores) && j.topScores.length > 0) {
    return "Low confidence (see JSON)";
  }
  if (Array.isArray(j.topScores) && j.topScores.length === 0) {
    return "No viable matches after scoring";
  }
  return "—";
}
