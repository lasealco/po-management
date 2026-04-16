import type { ShipmentStatus, TransportMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { createLogisticsShipment } from "@/lib/control-tower/create-logistics-shipment";
import { listControlTowerShipments } from "@/lib/control-tower/list-shipments";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

const STATUSES: ShipmentStatus[] = [
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
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  const ctx = await getControlTowerPortalContext(actorId);

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status") ?? "";
  const modeRaw = searchParams.get("mode") ?? "";
  const q = searchParams.get("q") ?? undefined;
  const shipperName = searchParams.get("shipperName") ?? undefined;
  const consigneeName = searchParams.get("consigneeName") ?? undefined;
  const lane = searchParams.get("lane") ?? undefined;
  const carrier = searchParams.get("carrier") ?? undefined;
  const supplierName = searchParams.get("supplierName") ?? undefined;
  const customerName = searchParams.get("customerName") ?? undefined;
  const originCode = searchParams.get("originCode") ?? undefined;
  const destinationCode = searchParams.get("destinationCode") ?? undefined;
  const takeRaw = searchParams.get("take");
  const takeParsed = takeRaw ? Number(takeRaw) : NaN;
  const take = Number.isFinite(takeParsed) ? takeParsed : undefined;
  const onlyOverdueEtaRaw = searchParams.get("onlyOverdueEta") ?? "";
  const routeActionRaw = searchParams.get("routeAction") ?? "";
  const dispatchOwnerUserId = searchParams.get("dispatchOwnerUserId")?.trim() || undefined;
  const minRouteProgressPctRaw = searchParams.get("minRouteProgressPct");
  const maxRouteProgressPctRaw = searchParams.get("maxRouteProgressPct");

  const status = STATUSES.includes(statusRaw as ShipmentStatus)
    ? (statusRaw as ShipmentStatus)
    : "";
  const mode = MODES.includes(modeRaw as TransportMode) ? (modeRaw as TransportMode) : "";
  const onlyOverdueEta =
    onlyOverdueEtaRaw === "1" || onlyOverdueEtaRaw.toLowerCase() === "true";
  const routeActionAllowed = ["Plan leg", "Mark departure", "Record arrival", "Route complete"] as const;
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

  const rows = await listControlTowerShipments({
    tenantId: tenant.id,
    ctx,
    query: {
      status: status || undefined,
      mode: mode || undefined,
      q,
      shipperName,
      consigneeName,
      lane,
      carrier: carrier?.trim() || undefined,
      supplierName: supplierName?.trim() || undefined,
      customerName: customerName?.trim() || undefined,
      originCode: originCode?.trim() || undefined,
      destinationCode: destinationCode?.trim() || undefined,
      take,
      onlyOverdueEta: onlyOverdueEta || undefined,
      routeActionPrefix: routeActionPrefix || undefined,
      dispatchOwnerUserId: dispatchOwnerUserId || undefined,
      minRouteProgressPct,
      maxRouteProgressPct,
    },
  });

  return NextResponse.json({ shipments: rows });
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
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  if (await userHasRoleNamed(actorId, "Supplier portal")) {
    return NextResponse.json(
      { error: "Supplier portal users cannot create logistics shipments here." },
      { status: 403 },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const orderId = typeof o.orderId === "string" ? o.orderId.trim() : "";
  const transportModeRaw = typeof o.transportMode === "string" ? o.transportMode.trim() : "";
  const transportMode = MODES.includes(transportModeRaw as TransportMode)
    ? (transportModeRaw as TransportMode)
    : null;
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }
  if (!transportMode) {
    return NextResponse.json(
      { error: "transportMode must be OCEAN, AIR, ROAD, or RAIL." },
      { status: 400 },
    );
  }

  const linesRaw = o.lines;
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
    return NextResponse.json(
      { error: "lines[] with orderItemId and quantityShipped is required." },
      { status: 400 },
    );
  }
  const lines: { orderItemId: string; quantityShipped: string }[] = [];
  for (const row of linesRaw) {
    if (!row || typeof row !== "object") {
      return NextResponse.json({ error: "Invalid line." }, { status: 400 });
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
      return NextResponse.json({ error: "Each line needs orderItemId and quantityShipped." }, { status: 400 });
    }
    lines.push({ orderItemId, quantityShipped });
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

  try {
    const { shipmentId } = await createLogisticsShipment({
      tenantId: tenant.id,
      actorUserId: actorId,
      orderId,
      lines,
      transportMode,
      shipmentNo: typeof o.shipmentNo === "string" ? o.shipmentNo : null,
      shippedAt: parseIsoDate(o.shippedAt) ?? null,
      carrier: typeof o.carrier === "string" ? o.carrier : null,
      trackingNo: typeof o.trackingNo === "string" ? o.trackingNo : null,
      notes: typeof o.notes === "string" ? o.notes : null,
      booking,
      milestonePackId,
    });
    return NextResponse.json({ ok: true, shipmentId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create shipment.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
