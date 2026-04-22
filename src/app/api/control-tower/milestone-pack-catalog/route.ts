import type { TransportMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


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
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const modeRaw = sp.get("mode")?.trim() ?? "";
  const modeValid = MODES.includes(modeRaw as TransportMode) ? (modeRaw as TransportMode) : null;
  if (modeRaw && !modeValid) {
    return toApiErrorResponse({ error: "Invalid mode. Use OCEAN, AIR, ROAD, RAIL, or omit mode for the full catalog.", code: "BAD_INPUT", status: 400 });
  }

  const full = await listMilestonePackCatalogForTenant(tenant.id);
  /** Omit `mode` for the full merged catalog; pass `mode` to restrict built-ins to that lane (tenant packs stay included). */
  const packs = modeValid ? filterMilestonePackCatalogByTransportMode(full, modeValid) : full;

  return NextResponse.json({ packs, modeFilter: modeValid });
}
