import type { AssistSuggestedFilters } from "@/lib/control-tower/assist";

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
  if (opts?.take != null) sp.set("take", String(opts.take));
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
