import type { ShipmentStatus, TransportMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { createLogisticsShipment } from "@/lib/control-tower/create-logistics-shipment";
import { listControlTowerShipments } from "@/lib/control-tower/list-shipments";
import {
  effectiveControlTowerQParam,
  parseControlTowerProductTraceParam,
} from "@/lib/control-tower/search-query";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const ctx = await getControlTowerPortalContext(actorId);

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status") ?? "";
  const modeRaw = searchParams.get("mode") ?? "";
  const productTrace = parseControlTowerProductTraceParam(searchParams.get("productTrace"));
  const qRaw = effectiveControlTowerQParam(searchParams.get("q"), productTrace);
  const q = qRaw || undefined;
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
  const minRouteProgressPctRaw = searchParams.get("minRouteProgressPct");
  const maxRouteProgressPctRaw = searchParams.get("maxRouteProgressPct");
  const shipmentSource =
    shipmentSourceRaw === "PO" || shipmentSourceRaw === "UNLINKED"
      ? shipmentSourceRaw
      : "";

  const status = STATUSES.includes(statusRaw as ShipmentStatus)
    ? (statusRaw as ShipmentStatus)
    : "";
  const mode = MODES.includes(modeRaw as TransportMode) ? (modeRaw as TransportMode) : "";
  const onlyOverdueEta =
    onlyOverdueEtaRaw === "1" || onlyOverdueEtaRaw.toLowerCase() === "true";
  const routeActionAllowed = [
    "Send booking",
    "Await booking",
    "Escalate booking",
    "Plan leg",
    "Mark departure",
    "Record arrival",
    "Route complete",
  ] as const;
  const routeActionPrefix = routeActionAllowed.includes(routeActionRaw as (typeof routeActionAllowed)[number])
    ? (routeActionRaw as (typeof routeActionAllowed)[number])
    : "";

  const parsePct = (v: string | null) => {
    if (!v) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(100, Math.round(n)));
  };
  const minRouteProgressPct = parsePct(minRouteProgressPctRaw);
  const maxRouteProgressPct = parsePct(maxRouteProgressPctRaw);

  const listResult = await listControlTowerShipments({
    tenantId: tenant.id,
    ctx,
    query: {
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
    },
  });

  return NextResponse.json({
    q: qRaw || null,
    productTrace: productTrace ?? null,
    shipments: listResult.rows,
    listLimit: listResult.listLimit,
    itemCount: listResult.rows.length,
    truncated: listResult.truncated,
  });
}

function parseIsoDate(v: unknown): Date | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Internal logistics shipment (PO-linked). Supplier portal users cannot call this.
 */
export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  if (await actorIsSupplierPortalRestricted(actorId)) {
    return toApiErrorResponse({ error: "Supplier portal users cannot create logistics shipments here.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;
  const orderId = typeof o.orderId === "string" ? o.orderId.trim() : "";
  const createUnlinked = o.createUnlinked === true;
  const transportModeRaw = typeof o.transportMode === "string" ? o.transportMode.trim() : "";
  const transportMode = MODES.includes(transportModeRaw as TransportMode)
    ? (transportModeRaw as TransportMode)
    : null;
  if (!transportMode) {
    return toApiErrorResponse({ error: "transportMode must be OCEAN, AIR, ROAD, or RAIL.", code: "BAD_INPUT", status: 400 });
  }

  const linesRaw = o.lines;
  const lines: { orderItemId: string; quantityShipped: string }[] = [];
  const shipperSupplierId =
    typeof o.shipperSupplierId === "string" ? o.shipperSupplierId.trim() : "";
  const consigneeCrmAccountId =
    typeof o.consigneeCrmAccountId === "string" ? o.consigneeCrmAccountId.trim() : "";
  if (!createUnlinked) {
    if (!orderId) {
      return toApiErrorResponse({ error: "orderId is required unless createUnlinked=true.", code: "BAD_INPUT", status: 400 });
    }
    if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
      return toApiErrorResponse({ error: "lines[] with orderItemId and quantityShipped is required.", code: "BAD_INPUT", status: 400 });
    }
    for (const row of linesRaw) {
      if (!row || typeof row !== "object") {
        return toApiErrorResponse({ error: "Invalid line.", code: "BAD_INPUT", status: 400 });
      }
      const r = row as Record<string, unknown>;
      const orderItemId = typeof r.orderItemId === "string" ? r.orderItemId.trim() : "";
      const quantityShipped =
        typeof r.quantityShipped === "string"
          ? r.quantityShipped
          : typeof r.quantityShipped === "number"
            ? String(r.quantityShipped)
            : "";
      if (!orderItemId || !quantityShipped.trim()) {
        return toApiErrorResponse({ error: "Each line needs orderItemId and quantityShipped.", code: "BAD_INPUT", status: 400 });
      }
      lines.push({ orderItemId, quantityShipped });
    }
  } else {
    if (!shipperSupplierId) {
      return toApiErrorResponse({ error: "shipperSupplierId is required for unlinked shipment.", code: "BAD_INPUT", status: 400 });
    }
    if (!consigneeCrmAccountId) {
      return toApiErrorResponse({ error: "consigneeCrmAccountId is required for unlinked shipment.", code: "BAD_INPUT", status: 400 });
    }
  }

  const bookingObj =
    o.booking && typeof o.booking === "object" ? (o.booking as Record<string, unknown>) : null;
  const booking = bookingObj
    ? {
        bookingNo: typeof bookingObj.bookingNo === "string" ? bookingObj.bookingNo : null,
        serviceLevel: typeof bookingObj.serviceLevel === "string" ? bookingObj.serviceLevel : null,
        originCode: typeof bookingObj.originCode === "string" ? bookingObj.originCode : null,
        destinationCode: typeof bookingObj.destinationCode === "string" ? bookingObj.destinationCode : null,
        etd: parseIsoDate(bookingObj.etd),
        eta: parseIsoDate(bookingObj.eta),
        latestEta: parseIsoDate(bookingObj.latestEta),
      }
    : null;

  const milestonePackId =
    typeof o.milestonePackId === "string" && o.milestonePackId.trim() ? o.milestonePackId.trim() : null;
  const carrierSupplierId = typeof o.carrierSupplierId === "string" ? o.carrierSupplierId.trim() : "";

  try {
    const { shipmentId, milestonePackWarning } = await createLogisticsShipment({
      tenantId: tenant.id,
      actorUserId: actorId,
      orderId: orderId || null,
      lines,
      unlinkedOrder: createUnlinked
        ? {
            referenceNo: typeof o.referenceNo === "string" ? o.referenceNo : null,
            shipperSupplierId,
            consigneeCrmAccountId,
            requestedDeliveryDate: parseIsoDate(o.requestedDeliveryDate),
          }
        : null,
      transportMode,
      shipmentNo: typeof o.shipmentNo === "string" ? o.shipmentNo : null,
      shippedAt: parseIsoDate(o.shippedAt) ?? null,
      carrierSupplierId: carrierSupplierId || null,
      trackingNo: typeof o.trackingNo === "string" ? o.trackingNo : null,
      notes: typeof o.notes === "string" ? o.notes : null,
      booking,
      milestonePackId,
    });
    return NextResponse.json({
      ok: true,
      shipmentId,
      milestonePackWarning: milestonePackWarning ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create shipment.";
    return toApiErrorResponse({ error: msg, code: "BAD_INPUT", status: 400 });
  }
}
