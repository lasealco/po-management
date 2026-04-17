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
  const takeRaw = searchParams.get("take");
  const takeParsed = takeRaw ? Number(takeRaw) : NaN;
  const take = Number.isFinite(takeParsed)
    ? Math.min(200, Math.max(1, Math.floor(takeParsed)))
    : undefined;

  const status = STATUSES.includes(statusRaw as ShipmentStatus)
    ? (statusRaw as ShipmentStatus)
    : undefined;
  const mode = MODES.includes(modeRaw as TransportMode) ? (modeRaw as TransportMode) : undefined;
  const onlyOverdueEta =
    onlyOverdueEtaRaw === "1" || onlyOverdueEtaRaw.toLowerCase() === "true" ? true : undefined;

  const hasStructured = Boolean(
    mode || status || onlyOverdueEta || lane,
  );
  if (!q && !hasStructured) {
    return NextResponse.json({
      shipments: [],
      message: "Provide q= text and/or filters: mode, status, onlyOverdueEta, lane.",
    });
  }

  const rows = await listControlTowerShipments({
    tenantId: tenant.id,
    ctx,
    query: {
      q: q || undefined,
      take: take ?? 60,
      status: status ?? "",
      mode: mode ?? "",
      onlyOverdueEta: onlyOverdueEta ?? false,
      lane,
    },
  });

  return NextResponse.json({ q: q || null, shipments: rows });
}
