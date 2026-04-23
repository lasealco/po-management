import type { ShipmentStatus, TransportMode } from "@prisma/client";

import {
  effectiveControlTowerQParam,
  parseControlTowerProductTraceParam,
} from "@/lib/control-tower/search-query";

import type { ListShipmentsQuery } from "./list-shipments";

const STATUSES: ShipmentStatus[] = [
  "BOOKING_DRAFT",
  "BOOKING_SUBMITTED",
  "SHIPPED",
  "VALIDATED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "RECEIVED",
];
const MODES: TransportMode[] = ["OCEAN", "AIR", "ROAD", "RAIL"];

const ROUTE_ACTION_ALLOWED = [
  "Send booking",
  "Await booking",
  "Escalate booking",
  "Plan leg",
  "Mark departure",
  "Record arrival",
  "Route complete",
] as const;

function parsePct(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Shared with `GET /api/control-tower/shipments` and `GET /api/control-tower/map-pins` so
 * the map and workbench use the same filter semantics when URL query params are aligned.
 */
export function parseControlTowerShipmentsListQuery(searchParams: URLSearchParams): {
  query: ListShipmentsQuery;
  /** Same as historic `GET …/shipments` JSON `q` field: effective search text. */
  qEcho: string | null;
  productTrace: string | undefined;
} {
  const statusRaw = searchParams.get("status") ?? "";
  const modeRaw = searchParams.get("mode") ?? "";
  const productTrace = parseControlTowerProductTraceParam(searchParams.get("productTrace"));
  const qUrl = searchParams.get("q");
  const qCombined = effectiveControlTowerQParam(qUrl, productTrace);
  const q = qCombined || undefined;
  const lane = searchParams.get("lane") ?? undefined;
  const carrierSupplierId = searchParams.get("carrierSupplierId") ?? undefined;
  const supplierId = searchParams.get("supplierId") ?? undefined;
  const customerCrmAccountId = searchParams.get("customerCrmAccountId") ?? undefined;
  const originCode = searchParams.get("originCode") ?? undefined;
  const destinationCode = searchParams.get("destinationCode") ?? undefined;
  const shipmentSourceRaw = searchParams.get("shipmentSource") ?? "";
  const takeRaw = searchParams.get("take");
  const takeParsed = takeRaw ? Number(takeRaw) : NaN;
  const take = Number.isFinite(takeParsed) ? takeParsed : undefined;
  const onlyOverdueEtaRaw = searchParams.get("onlyOverdueEta") ?? "";
  const routeActionRaw = searchParams.get("routeAction") ?? "";
  const dispatchOwnerUserId = searchParams.get("dispatchOwnerUserId")?.trim() || undefined;
  const exceptionCodeRaw = searchParams.get("exceptionCode")?.trim() ?? "";
  const exceptionCode =
    exceptionCodeRaw.length > 0 && exceptionCodeRaw.length <= 80 && /^[\w.-]+$/i.test(exceptionCodeRaw)
      ? exceptionCodeRaw
      : undefined;
  const alertTypeRaw = searchParams.get("alertType")?.trim() ?? "";
  const alertType =
    alertTypeRaw.length > 0 && alertTypeRaw.length <= 80 && /^[\w.-]+$/i.test(alertTypeRaw)
      ? alertTypeRaw
      : undefined;
  const shipmentSource =
    shipmentSourceRaw === "PO" || shipmentSourceRaw === "UNLINKED" ? shipmentSourceRaw : "";

  const status = STATUSES.includes(statusRaw as ShipmentStatus) ? (statusRaw as ShipmentStatus) : "";
  const mode = MODES.includes(modeRaw as TransportMode) ? (modeRaw as TransportMode) : "";
  const onlyOverdueEta = onlyOverdueEtaRaw === "1" || onlyOverdueEtaRaw.toLowerCase() === "true";
  const routeActionPrefix = ROUTE_ACTION_ALLOWED.includes(
    routeActionRaw as (typeof ROUTE_ACTION_ALLOWED)[number],
  )
    ? (routeActionRaw as (typeof ROUTE_ACTION_ALLOWED)[number])
    : "";
  const minRouteProgressPct = parsePct(searchParams.get("minRouteProgressPct"));
  const maxRouteProgressPct = parsePct(searchParams.get("maxRouteProgressPct"));

  const query: ListShipmentsQuery = {
    status: status || undefined,
    mode: mode || undefined,
    q,
    lane,
    carrierSupplierId: carrierSupplierId?.trim() || undefined,
    supplierId: supplierId?.trim() || undefined,
    customerCrmAccountId: customerCrmAccountId?.trim() || undefined,
    originCode: originCode?.trim() || undefined,
    destinationCode: destinationCode?.trim() || undefined,
    shipmentSource: shipmentSource || undefined,
    take,
    onlyOverdueEta: onlyOverdueEta || undefined,
    routeActionPrefix: routeActionPrefix || undefined,
    dispatchOwnerUserId: dispatchOwnerUserId || undefined,
    exceptionCode,
    alertType,
    minRouteProgressPct,
    maxRouteProgressPct,
  };

  return {
    query,
    qEcho: qCombined || null,
    productTrace,
  };
}
