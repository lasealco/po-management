import type { CtReportDimension } from "@/lib/control-tower/report-engine";

const CT_URL_STATUSES = new Set([
  "SHIPPED",
  "VALIDATED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "RECEIVED",
]);

const CT_URL_MODES = new Set(["OCEAN", "AIR", "ROAD", "RAIL"]);

/**
 * Maps a Control Tower report dimension + aggregated row to workbench list query params.
 * Uses explicit API params (carrier, supplierName, …) where possible instead of broad `q`.
 * Returns null when there is no sensible workbench filter (e.g. month bucket).
 */
export function buildControlTowerWorkbenchDrillQuery(params: {
  dimension: string;
  rowKey: string;
  rowLabel: string;
}): string | null {
  const dim = params.dimension as CtReportDimension;
  const key = params.rowKey.trim();
  const label = (params.rowLabel || key).trim();

  if (dim === "none" || dim === "month") return null;

  const sp = new URLSearchParams();

  if (dim === "status") {
    const v = CT_URL_STATUSES.has(key) ? key : CT_URL_STATUSES.has(label) ? label : "";
    if (!v) return null;
    sp.set("status", v);
    return sp.toString();
  }

  if (dim === "mode") {
    const v = CT_URL_MODES.has(key) ? key : CT_URL_MODES.has(label) ? label : "";
    if (!v) return null;
    sp.set("mode", v);
    return sp.toString();
  }

  if (dim === "lane") {
    const parts = key
      .split("->")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      parts.length >= 2 &&
      parts[0] &&
      parts[1] &&
      parts[0] !== "?" &&
      parts[1] !== "?"
    ) {
      sp.set("originCode", parts[0]);
      sp.set("destinationCode", parts[1]);
      return sp.toString();
    }
    const lanePart = parts[0] || key;
    if (!lanePart || lanePart === "?") return null;
    sp.set("lane", lanePart);
    return sp.toString();
  }

  if (dim === "carrier") {
    const v = label && label !== "Unknown" ? label : key && key !== "Unknown" ? key : "";
    if (!v) return null;
    sp.set("carrier", v);
    return sp.toString();
  }

  if (dim === "customer") {
    const v = label && label !== "Unknown" ? label : key && key !== "Unknown" ? key : "";
    if (!v) return null;
    sp.set("customerName", v);
    return sp.toString();
  }

  if (dim === "supplier") {
    const v = label && label !== "Unknown" ? label : key && key !== "Unknown" ? key : "";
    if (!v) return null;
    sp.set("supplierName", v);
    return sp.toString();
  }

  if (dim === "origin") {
    const code = key && key !== "Unknown" ? key : label;
    if (!code || code === "Unknown") return null;
    sp.set("originCode", code);
    return sp.toString();
  }

  if (dim === "destination") {
    const code = key && key !== "Unknown" ? key : label;
    if (!code || code === "Unknown") return null;
    sp.set("destinationCode", code);
    return sp.toString();
  }

  return null;
}

export function controlTowerWorkbenchDrillHref(params: {
  dimension: string;
  rowKey: string;
  rowLabel: string;
}): string | null {
  const q = buildControlTowerWorkbenchDrillQuery(params);
  if (!q) return null;
  return `/control-tower/workbench?${q}`;
}
