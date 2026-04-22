import type { AssistSuggestedFilters } from "@/lib/control-tower/assist";

const MAX_PRODUCT_TRACE_LEN = 80;

/** Validate `productTrace` query param (same rules as assist catalog-style tokens). */
export function parseControlTowerProductTraceParam(raw: string | null | undefined): string | undefined {
  const t = raw?.trim() ?? "";
  if (!t || t.length > MAX_PRODUCT_TRACE_LEN) return undefined;
  if (!/^[\w.-]+$/i.test(t)) return undefined;
  return t;
}

/** Prefer explicit `q`; fall back to validated product / SKU trace code. */
export function effectiveControlTowerQParam(
  qRaw: string | null | undefined,
  productTrace: string | undefined,
): string {
  const q = qRaw?.trim() ?? "";
  return q || productTrace || "";
}

/** Apply assist / structured filters to a URLSearchParams for GET /api/control-tower/search or workbench. */
export function appendAssistToSearchParams(
  sp: URLSearchParams,
  filters: AssistSuggestedFilters,
  opts?: { take?: number },
): void {
  if (filters.q?.trim()) sp.set("q", filters.q.trim());
  if (filters.mode) sp.set("mode", filters.mode);
  if (filters.status) sp.set("status", filters.status);
  if (filters.onlyOverdueEta) sp.set("onlyOverdueEta", "1");
  if (filters.lane?.trim()) sp.set("lane", filters.lane.trim());
  if (filters.supplierId?.trim()) sp.set("supplierId", filters.supplierId.trim());
  if (filters.customerCrmAccountId?.trim()) sp.set("customerCrmAccountId", filters.customerCrmAccountId.trim());
  if (filters.carrierSupplierId?.trim()) sp.set("carrierSupplierId", filters.carrierSupplierId.trim());
  if (filters.originCode?.trim()) sp.set("originCode", filters.originCode.trim());
  if (filters.destinationCode?.trim()) sp.set("destinationCode", filters.destinationCode.trim());
  if (filters.routeAction?.trim()) sp.set("routeAction", filters.routeAction.trim());
  if (filters.shipmentSource === "PO" || filters.shipmentSource === "UNLINKED") {
    sp.set("shipmentSource", filters.shipmentSource);
  }
  if (filters.dispatchOwnerUserId?.trim()) sp.set("dispatchOwnerUserId", filters.dispatchOwnerUserId.trim());
  if (filters.exceptionCode?.trim()) sp.set("exceptionCode", filters.exceptionCode.trim());
  if (filters.alertType?.trim()) sp.set("alertType", filters.alertType.trim());
  if (filters.productTraceQ?.trim()) sp.set("productTrace", filters.productTraceQ.trim());
  if (opts?.take != null) sp.set("take", String(opts.take));
}

/**
 * After `appendAssistToSearchParams`, merges raw box input when assist did not set `q`.
 * If the whole trimmed input is a valid product-trace token, sets `productTrace` only (no `q`) so URLs and
 * APIs match assist-driven trace queries. Otherwise sets `q` to the trimmed text.
 */
export function mergeRawControlTowerSearchInput(sp: URLSearchParams, rawInput: string): void {
  const trimmed = rawInput.trim();
  if (!trimmed) return;
  if (sp.has("q")) return;
  const pt = parseControlTowerProductTraceParam(trimmed);
  if (pt && pt === trimmed) {
    if (!sp.has("productTrace")) sp.set("productTrace", pt);
    return;
  }
  sp.set("q", trimmed);
}

export function hasStructuredSearchInput(filters: AssistSuggestedFilters): boolean {
  return Boolean(
    filters.mode ||
      filters.status ||
      filters.onlyOverdueEta ||
      filters.lane?.trim() ||
      filters.supplierId?.trim() ||
      filters.customerCrmAccountId?.trim() ||
      filters.carrierSupplierId?.trim() ||
      filters.originCode?.trim() ||
      filters.destinationCode?.trim() ||
      filters.routeAction?.trim() ||
      filters.shipmentSource === "PO" ||
      filters.shipmentSource === "UNLINKED" ||
      filters.dispatchOwnerUserId?.trim() ||
      filters.exceptionCode?.trim() ||
      filters.alertType?.trim() ||
      filters.productTraceQ?.trim(),
  );
}
