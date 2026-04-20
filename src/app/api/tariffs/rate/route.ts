import { NextResponse } from "next/server";
import type { TariffTransportMode } from "@prisma/client";

import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { normalizeEquipmentType, rateTariffLane } from "@/lib/tariff/rating-engine";

export const dynamic = "force-dynamic";

const MODES = new Set<TariffTransportMode>([
  "OCEAN",
  "AIR",
  "LCL",
  "TRUCK",
  "RAIL",
  "LOCAL_SERVICE",
]);

function parseDate(s: string): Date | null {
  const d = new Date(`${s.trim()}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Operational lane rating (v1): approved headers + approved frozen versions, geography heuristics, totals.
 */
export async function POST(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const pol = typeof o.pol === "string" ? o.pol.trim() : "";
  const pod = typeof o.pod === "string" ? o.pod.trim() : "";
  const equipmentRaw = typeof o.equipment === "string" && o.equipment.trim() ? o.equipment : "40HC";
  const mode = typeof o.transportMode === "string" ? (o.transportMode.trim().toUpperCase() as TariffTransportMode) : "OCEAN";
  if (!pol || !pod) {
    return NextResponse.json({ error: "pol and pod are required." }, { status: 400 });
  }
  if (!MODES.has(mode)) {
    return NextResponse.json({ error: "Invalid transportMode." }, { status: 400 });
  }

  const asOfStr = typeof o.asOf === "string" && o.asOf.trim() ? o.asOf.trim() : new Date().toISOString().slice(0, 10);
  const asOf = parseDate(asOfStr);
  if (!asOf) return NextResponse.json({ error: "Invalid asOf date." }, { status: 400 });

  const providerIds = Array.isArray(o.providerIds)
    ? o.providerIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : undefined;

  const maxResults = typeof o.maxResults === "number" && Number.isFinite(o.maxResults) ? Math.floor(o.maxResults) : undefined;

  const result = await rateTariffLane({
    tenantId: tenant.id,
    pol,
    pod,
    equipment: normalizeEquipmentType(equipmentRaw),
    asOf,
    transportMode: mode,
    providerIds,
    maxResults,
  });

  return NextResponse.json(result);
}
