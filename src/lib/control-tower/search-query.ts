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
  if (filters.shipperName?.trim()) sp.set("shipperName", filters.shipperName.trim());
  if (filters.consigneeName?.trim()) sp.set("consigneeName", filters.consigneeName.trim());
  if (filters.lane?.trim()) sp.set("lane", filters.lane.trim());
  if (opts?.take != null) sp.set("take", String(opts.take));
}

export function hasStructuredSearchInput(filters: AssistSuggestedFilters): boolean {
  return Boolean(
    filters.mode ||
      filters.status ||
      filters.onlyOverdueEta ||
      filters.shipperName?.trim() ||
      filters.consigneeName?.trim() ||
      filters.lane?.trim(),
  );
}
