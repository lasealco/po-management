import type { ShipmentStatus, TransportMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { listControlTowerShipments } from "@/lib/control-tower/list-shipments";
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

const DEFAULT_SEARCH_TAKE = 60;
const MAX_SEARCH_TAKE = 200;

const ROUTE_ACTION_ALLOWED = [
  "Send booking",
  "Await booking",
  "Escalate booking",
  "Plan leg",
  "Mark departure",
  "Record arrival",
  "Route complete",
] as const;

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
  const q = searchParams.get("q")?.trim() ?? "";
  const statusRaw = searchParams.get("status") ?? "";
  const modeRaw = searchParams.get("mode") ?? "";
  const onlyOverdueEtaRaw = searchParams.get("onlyOverdueEta") ?? "";
  const lane = searchParams.get("lane")?.trim() || undefined;
  const supplierIdRaw = searchParams.get("supplierId")?.trim() ?? "";
  const customerCrmAccountIdRaw = searchParams.get("customerCrmAccountId")?.trim() ?? "";
  const carrierSupplierIdRaw = searchParams.get("carrierSupplierId")?.trim() ?? "";
  const originCodeRaw = searchParams.get("originCode")?.trim() ?? "";
  const destinationCodeRaw = searchParams.get("destinationCode")?.trim() ?? "";
  const isProbableCuid = (s: string) => s.length >= 20 && s.length <= 32 && /^c[a-z0-9]+$/i.test(s);
  const supplierId = isProbableCuid(supplierIdRaw) ? supplierIdRaw : undefined;
  const customerCrmAccountId = isProbableCuid(customerCrmAccountIdRaw) ? customerCrmAccountIdRaw : undefined;
  const carrierSupplierId = isProbableCuid(carrierSupplierIdRaw) ? carrierSupplierIdRaw : undefined;
  const portToken = (s: string) => {
    const t = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return t.length >= 3 && t.length <= 10 ? t : undefined;
  };
  const originCode = portToken(originCodeRaw);
  const destinationCode = portToken(destinationCodeRaw);
  const shipmentSourceRaw = searchParams.get("shipmentSource")?.trim() ?? "";
  const shipmentSource: "PO" | "UNLINKED" | undefined =
    shipmentSourceRaw === "PO" || shipmentSourceRaw === "UNLINKED" ? shipmentSourceRaw : undefined;
  const dispatchOwnerUserIdRaw = searchParams.get("dispatchOwnerUserId")?.trim() ?? "";
  const dispatchOwnerUserId = isProbableCuid(dispatchOwnerUserIdRaw) ? dispatchOwnerUserIdRaw : undefined;
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
  const routeActionRaw = searchParams.get("routeAction")?.trim() ?? "";
  const routeActionPrefix = ROUTE_ACTION_ALLOWED.find((a) => a === routeActionRaw);
  const takeRaw = searchParams.get("take");
  const takeParsed = takeRaw ? Number(takeRaw) : NaN;
  const take = Number.isFinite(takeParsed)
    ? Math.min(MAX_SEARCH_TAKE, Math.max(1, Math.floor(takeParsed)))
    : undefined;
  const effectiveTake = take ?? DEFAULT_SEARCH_TAKE;

  const status = STATUSES.includes(statusRaw as ShipmentStatus)
    ? (statusRaw as ShipmentStatus)
    : undefined;
  const mode = MODES.includes(modeRaw as TransportMode) ? (modeRaw as TransportMode) : undefined;
  const onlyOverdueEta =
    onlyOverdueEtaRaw === "1" || onlyOverdueEtaRaw.toLowerCase() === "true" ? true : undefined;

  const hasStructured = Boolean(
    mode ||
      status ||
      onlyOverdueEta ||
      lane ||
      supplierId ||
      customerCrmAccountId ||
      carrierSupplierId ||
      originCode ||
      destinationCode ||
      routeActionPrefix ||
      shipmentSource ||
      dispatchOwnerUserId ||
      exceptionCode ||
      alertType,
  );
  if (!q && !hasStructured) {
    return NextResponse.json({
      shipments: [],
      searchLimit: DEFAULT_SEARCH_TAKE,
      itemCount: 0,
      truncated: false,
      message:
        "Provide q= text and/or filters: mode, status, onlyOverdueEta, lane, originCode, destinationCode, routeAction, shipmentSource, dispatchOwnerUserId, supplierId, customerCrmAccountId, carrierSupplierId, exceptionCode, alertType.",
    });
  }

  const listResult = await listControlTowerShipments({
    tenantId: tenant.id,
    ctx,
    query: {
      q: q || undefined,
      take: effectiveTake,
      status: status ?? "",
      mode: mode ?? "",
      onlyOverdueEta: onlyOverdueEta ?? false,
      lane,
      supplierId,
      customerCrmAccountId,
      carrierSupplierId,
      originCode,
      destinationCode,
      routeActionPrefix,
      shipmentSource: shipmentSource ?? "",
      dispatchOwnerUserId,
      exceptionCode,
      alertType,
    },
  });

  return NextResponse.json({
    q: q || null,
    searchLimit: listResult.listLimit,
    itemCount: listResult.rows.length,
    truncated: listResult.truncated,
    shipments: listResult.rows,
  });
}
