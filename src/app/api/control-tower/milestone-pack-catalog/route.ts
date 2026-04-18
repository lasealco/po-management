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

  const sp = new URL(request.url).searchParams;
  const modeRaw = sp.get("mode")?.trim() ?? "";
  const modeValid = MODES.includes(modeRaw as TransportMode) ? (modeRaw as TransportMode) : null;
  if (modeRaw && !modeValid) {
    return NextResponse.json(
      { error: "Invalid mode. Use OCEAN, AIR, ROAD, RAIL, or omit mode for the full catalog." },
      { status: 400 },
    );
  }

  const full = await listMilestonePackCatalogForTenant(tenant.id);
  /** Omit `mode` for the full merged catalog; pass `mode` to restrict built-ins to that lane (tenant packs stay included). */
  const packs = modeValid ? filterMilestonePackCatalogByTransportMode(full, modeValid) : full;

  return NextResponse.json({ packs, modeFilter: modeValid });
}
