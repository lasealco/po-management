export const CT_URL_STATUSES = new Set([
  "SHIPPED",
  "VALIDATED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "RECEIVED",
]);

export const CT_URL_MODES = new Set(["OCEAN", "AIR", "ROAD", "RAIL"]);

export const CT_URL_ROUTE_ACTION_PREFIXES = new Set([
  "Plan leg",
  "Mark departure",
  "Record arrival",
  "Route complete",
]);

export type WorkbenchUrlState = {
  status: string;
  mode: string;
  routeAction: string;
  sortBy: string;
  page: number;
  onlyOverdueEta: boolean;
  q: string;
  shipperFilter: string;
  consigneeFilter: string;
  laneFilter: string;
  carrierFilter: string;
  supplierNameFilter: string;
  customerNameFilter: string;
  originCodeFilter: string;
  destinationCodeFilter: string;
  ownerFilter: string;
  routeHealth: string;
  /** Default true; URL carries `autoRefresh=0` when off. */
  autoRefresh: boolean;
  /**
   * When `milestones`, shipment links from the workbench open Shipment 360 on the Milestones tab.
   * URL param: `ship360Tab=milestones`.
   */
  ship360Tab: "" | "milestones";
};

const SORT_OPTIONS = ["updated_desc", "eta_asc", "route_progress_asc"] as const;

export function readWorkbenchUrlState(
  sp: URLSearchParams,
  restrictedView: boolean,
): WorkbenchUrlState {
  const st = sp.get("status") ?? "";
  const status = CT_URL_STATUSES.has(st) ? st : "";
  const mo = sp.get("mode") ?? "";
  const mode = CT_URL_MODES.has(mo) ? mo : "";
  const ra = sp.get("routeAction") ?? "";
  const routeAction = CT_URL_ROUTE_ACTION_PREFIXES.has(ra) ? ra : "";
  const sortRaw = sp.get("sortBy") ?? "";
  const sortBy = SORT_OPTIONS.includes(sortRaw as (typeof SORT_OPTIONS)[number])
    ? sortRaw
    : "updated_desc";
  const pageRaw = sp.get("page") ?? "";
  const pageParsed = pageRaw && /^\d+$/.test(pageRaw) ? Number(pageRaw) : 1;
  const page = Number.isFinite(pageParsed) ? Math.max(1, Math.min(10_000, Math.floor(pageParsed))) : 1;
  const oo = sp.get("onlyOverdueEta") ?? "";
  const onlyOverdueEta = oo === "1" || oo.toLowerCase() === "true";
  const minPct = sp.get("minRouteProgressPct");
  const maxPct = sp.get("maxRouteProgressPct");
  let routeHealth = "";
  if (minPct === "0" && maxPct === "40") routeHealth = "stalled";
  else if (minPct === "41" && maxPct === "79") routeHealth = "mid";
  else if (minPct === "80" && maxPct === "100") routeHealth = "advanced";
  const owner = sp.get("dispatchOwnerUserId") ?? "";
  const ar = sp.get("autoRefresh") ?? "";
  const autoRefresh =
    ar === "0" || ar.toLowerCase() === "false" || ar.toLowerCase() === "off" ? false : true;
  const tabRaw = (sp.get("ship360Tab") ?? "").toLowerCase();
  const ship360Tab: "" | "milestones" = tabRaw === "milestones" ? "milestones" : "";
  return {
    status,
    mode,
    routeAction,
    sortBy,
    page,
    onlyOverdueEta,
    autoRefresh,
    ship360Tab,
    q: sp.get("q") ?? "",
    shipperFilter: sp.get("shipperName") ?? "",
    consigneeFilter: sp.get("consigneeName") ?? "",
    laneFilter: sp.get("lane") ?? "",
    carrierFilter: sp.get("carrier") ?? "",
    supplierNameFilter: sp.get("supplierName") ?? "",
    customerNameFilter: sp.get("customerName") ?? "",
    originCodeFilter: sp.get("originCode") ?? "",
    destinationCodeFilter: sp.get("destinationCode") ?? "",
    ownerFilter: restrictedView ? "" : owner,
    routeHealth,
  };
}

export function buildWorkbenchSearchString(state: WorkbenchUrlState, restrictedView: boolean): string {
  const p = new URLSearchParams();
  if (state.status) p.set("status", state.status);
  if (state.mode) p.set("mode", state.mode);
  if (state.q.trim()) p.set("q", state.q.trim());
  if (state.shipperFilter.trim()) p.set("shipperName", state.shipperFilter.trim());
  if (state.consigneeFilter.trim()) p.set("consigneeName", state.consigneeFilter.trim());
  if (state.laneFilter.trim()) p.set("lane", state.laneFilter.trim());
  if (state.carrierFilter.trim()) p.set("carrier", state.carrierFilter.trim());
  if (state.supplierNameFilter.trim()) p.set("supplierName", state.supplierNameFilter.trim());
  if (state.customerNameFilter.trim()) p.set("customerName", state.customerNameFilter.trim());
  if (state.originCodeFilter.trim()) p.set("originCode", state.originCodeFilter.trim());
  if (state.destinationCodeFilter.trim()) p.set("destinationCode", state.destinationCodeFilter.trim());
  if (!restrictedView && state.ownerFilter.trim()) p.set("dispatchOwnerUserId", state.ownerFilter.trim());
  if (state.onlyOverdueEta) p.set("onlyOverdueEta", "1");
  if (state.routeAction) p.set("routeAction", state.routeAction);
  if (state.routeHealth === "stalled") {
    p.set("minRouteProgressPct", "0");
    p.set("maxRouteProgressPct", "40");
  } else if (state.routeHealth === "mid") {
    p.set("minRouteProgressPct", "41");
    p.set("maxRouteProgressPct", "79");
  } else if (state.routeHealth === "advanced") {
    p.set("minRouteProgressPct", "80");
    p.set("maxRouteProgressPct", "100");
  }
  if (state.sortBy !== "updated_desc") p.set("sortBy", state.sortBy);
  if (state.page > 1) p.set("page", String(state.page));
  if (!state.autoRefresh) p.set("autoRefresh", "0");
  if (state.ship360Tab === "milestones") p.set("ship360Tab", "milestones");
  return p.toString();
}
