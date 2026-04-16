import type { TransportMode } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import {
  filterMilestonePackCatalogByTransportMode,
  listMilestonePackCatalogForTenant,
} from "@/lib/control-tower/milestone-templates";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

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

  const modeRaw = new URL(request.url).searchParams.get("mode") ?? "";
  const mode = MODES.includes(modeRaw as TransportMode) ? (modeRaw as TransportMode) : null;

  const full = await listMilestonePackCatalogForTenant(tenant.id);
  const packs = mode ? filterMilestonePackCatalogByTransportMode(full, mode) : [];

  return NextResponse.json({ packs });
}
