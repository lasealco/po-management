import type { ShipmentStatus, TransportMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
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
  const take = searchParams.get("take");
  const onlyOverdueEtaRaw = searchParams.get("onlyOverdueEta") ?? "";
  const routeActionRaw = searchParams.get("routeAction") ?? "";
  const dispatchOwnerUserId = searchParams.get("dispatchOwnerUserId")?.trim() || undefined;

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

  const rows = await listControlTowerShipments({
    tenantId: tenant.id,
    ctx,
    query: {
      status: status || undefined,
      mode: mode || undefined,
      q,
      take: take ? Number(take) : undefined,
      onlyOverdueEta: onlyOverdueEta || undefined,
      routeActionPrefix: routeActionPrefix || undefined,
      dispatchOwnerUserId: dispatchOwnerUserId || undefined,
    },
  });

  return NextResponse.json({ shipments: rows });
}
