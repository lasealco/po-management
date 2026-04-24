import type { TransportMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { createLogisticsShipment } from "@/lib/control-tower/create-logistics-shipment";
import { listControlTowerShipments } from "@/lib/control-tower/list-shipments";
import { parseControlTowerShipmentsListQuery } from "@/lib/control-tower/shipments-list-query-from-search-params";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

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
  const parsed = parseControlTowerShipmentsListQuery(searchParams);

  const listResult = await listControlTowerShipments({
    tenantId: tenant.id,
    ctx,
    actorUserId: actorId,
    query: parsed.query,
  });

  return NextResponse.json({
    q: parsed.qEcho,
    productTrace: parsed.productTrace ?? null,
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
