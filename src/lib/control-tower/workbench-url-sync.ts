import { parseControlTowerProductTraceParam } from "@/lib/control-tower/search-query";

export const CT_URL_STATUSES = new Set([
  "BOOKING_DRAFT",
  "BOOKING_SUBMITTED",
  "SHIPPED",
  "VALIDATED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "RECEIVED",
]);

export const CT_URL_MODES = new Set(["OCEAN", "AIR", "ROAD", "RAIL"]);

export const CT_URL_ROUTE_ACTION_PREFIXES = new Set([
  "Send booking",
  "Await booking",
  "Escalate booking",
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
  /** Validated SKU / buyer code (`productTrace` query param); empty if absent or invalid. */
  productTraceFilter: string;
  laneFilter: string;
  carrierSupplierIdFilter: string;
  supplierIdFilter: string;
  customerCrmAccountIdFilter: string;
  originCodeFilter: string;
  destinationCodeFilter: string;
  /** Open / in-progress `CtException.type` (catalog code). */
  exceptionCodeFilter: string;
  /** Open / acknowledged `CtAlert.type`. */
  alertTypeFilter: string;
  shipmentSource: "" | "PO" | "UNLINKED";
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
  const sourceRaw = sp.get("shipmentSource") ?? "";
  const shipmentSource: "" | "PO" | "UNLINKED" =
    sourceRaw === "PO" || sourceRaw === "UNLINKED" ? sourceRaw : "";
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
    productTraceFilter: parseControlTowerProductTraceParam(sp.get("productTrace")) ?? "",
    laneFilter: sp.get("lane") ?? "",
    carrierSupplierIdFilter: sp.get("carrierSupplierId") ?? "",
    supplierIdFilter: sp.get("supplierId") ?? "",
    customerCrmAccountIdFilter: sp.get("customerCrmAccountId") ?? "",
    originCodeFilter: sp.get("originCode") ?? "",
    destinationCodeFilter: sp.get("destinationCode") ?? "",
    shipmentSource,
    ownerFilter: restrictedView ? "" : owner,
    routeHealth,
    exceptionCodeFilter: sp.get("exceptionCode") ?? "",
    alertTypeFilter: sp.get("alertType") ?? "",
  };
}

export function buildWorkbenchSearchString(state: WorkbenchUrlState, restrictedView: boolean): string {
  const p = new URLSearchParams();
  if (state.status) p.set("status", state.status);
  if (state.mode) p.set("mode", state.mode);
  if (state.q.trim()) p.set("q", state.q.trim());
  const productTrace = parseControlTowerProductTraceParam(state.productTraceFilter || null);
  if (productTrace) p.set("productTrace", productTrace);
  if (state.laneFilter.trim()) p.set("lane", state.laneFilter.trim());
  if (state.carrierSupplierIdFilter.trim()) p.set("carrierSupplierId", state.carrierSupplierIdFilter.trim());
  if (state.supplierIdFilter.trim()) p.set("supplierId", state.supplierIdFilter.trim());
  if (state.customerCrmAccountIdFilter.trim()) p.set("customerCrmAccountId", state.customerCrmAccountIdFilter.trim());
  if (state.originCodeFilter.trim()) p.set("originCode", state.originCodeFilter.trim());
  if (state.destinationCodeFilter.trim()) p.set("destinationCode", state.destinationCodeFilter.trim());
  if (state.exceptionCodeFilter.trim()) p.set("exceptionCode", state.exceptionCodeFilter.trim());
  if (state.alertTypeFilter.trim()) p.set("alertType", state.alertTypeFilter.trim());
  if (state.shipmentSource) p.set("shipmentSource", state.shipmentSource);
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

/**
 * Builds `/control-tower/workbench?…` for deep links from dashboards and other pages.
 * Keys should match workbench URL params (`readWorkbenchUrlState`); values are not validated here.
 * Common keys: `status`, `mode`, `q`, `productTrace`, lane/port filters, `routeAction`, etc.
 */
export function controlTowerWorkbenchPath(query: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    const t = v.trim();
    if (t) p.set(k, t);
  }
  const s = p.toString();
  return s ? `/control-tower/workbench?${s}` : "/control-tower/workbench";
}

/**
 * When the trace search box value is a validated SKU / buyer code, returns a workbench URL with `productTrace=`.
 * Otherwise `null` (use the bare workbench path).
 */
export function controlTowerWorkbenchPathForValidatedProductTrace(q: string): string | null {
  const t = parseControlTowerProductTraceParam(q.trim() || null);
  return t ? controlTowerWorkbenchPath({ productTrace: t }) : null;
}

const PORT_TOKEN = /^[A-Z0-9]{3,10}$/;

/**
 * Maps reporting ETA lane labels (`ORIG->DEST`, possibly with `?`) to workbench
 * `originCode` / `destinationCode` query params.
 */
export function controlTowerWorkbenchPathFromEtaLaneLabel(laneLabel: string): string {
  const parts = laneLabel.trim().split("->");
  if (parts.length !== 2) return "/control-tower/workbench";
  const norm = (s: string) =>
    s
      .trim()
      .replaceAll("?", "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  const o = norm(parts[0]);
  const d = norm(parts[1]);
  const q: Record<string, string> = {};
  if (PORT_TOKEN.test(o)) q.originCode = o;
  if (PORT_TOKEN.test(d)) q.destinationCode = d;
  return controlTowerWorkbenchPath(q);
}
