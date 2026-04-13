/**
 * Lightweight R5 “assistant”: maps free text to suggested workbench filters (no LLM).
 */
export function assistControlTowerQuery(raw: string): {
  hints: string[];
  suggestedFilters: { status?: string; mode?: string; q?: string };
} {
  const q = raw.trim();
  const hints: string[] = [];
  const suggestedFilters: { status?: string; mode?: string; q?: string } = {};

  if (!q) {
    hints.push("Try a PO number, B/L reference, container id, or carrier name.");
    return { hints, suggestedFilters };
  }

  suggestedFilters.q = q;

  if (/^PO[-\s]?/i.test(q)) {
    hints.push("Looks like a PO reference — applied as a broad text search.");
  }
  if (/\bBL\b|bill of lading|master|house/i.test(q)) {
    hints.push("For B/L numbers, search also matches saved reference values on shipments.");
  }
  if (/\b(20|40)\s*(ft|hc|hq)\b/i.test(q)) {
    hints.push("Equipment hints are not indexed yet; searching as plain text.");
  }
  const modeHints: Array<{ re: RegExp; mode: string; label: string }> = [
    { re: /\bFCL\b|\bLCL\b|ocean|vessel|container ship/i, mode: "OCEAN", label: "Ocean" },
    { re: /\bAWB\b|air freight|flight\b/i, mode: "AIR", label: "Air" },
    { re: /\bFTL\b|\bLTL\b|truck|road/i, mode: "ROAD", label: "Road" },
    { re: /\brail\b|intermodal/i, mode: "RAIL", label: "Rail" },
    {
      re: /\bcourier\b|\bparcel\b|\bexpress\b|DHL|FedEx|UPS\b/i,
      mode: "ROAD",
      label: "Courier / parcel (mapped to road in filters)",
    },
  ];
  for (const { re, mode, label } of modeHints) {
    if (re.test(q)) {
      suggestedFilters.mode = mode;
      hints.push(`Detected ${label} — applied mode filter (${mode}).`);
      break;
    }
  }

  if (hints.length === 0) {
    hints.push("Applied as a text search across order #, shipment #, tracking, carrier, and references.");
  }

  return { hints, suggestedFilters };
}
