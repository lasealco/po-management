import { NextResponse } from "next/server";
import type { TariffTransportMode } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { normalizeEquipmentType, rateTariffLane } from "@/lib/tariff/rating-engine";
import { TARIFF_TRANSPORT_MODE_SET } from "@/lib/tariff/tariff-enum-sets";

export const dynamic = "force-dynamic";

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
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;

  const pol = typeof o.pol === "string" ? o.pol.trim() : "";
  const pod = typeof o.pod === "string" ? o.pod.trim() : "";
  const equipmentRaw = typeof o.equipment === "string" && o.equipment.trim() ? o.equipment : "40HC";
  const modeRaw =
    typeof o.transportMode === "string" && o.transportMode.trim()
      ? o.transportMode.trim().toUpperCase()
      : "OCEAN";
  if (!pol || !pod) {
    return toApiErrorResponse({ error: "pol and pod are required.", code: "BAD_INPUT", status: 400 });
  }
  if (!TARIFF_TRANSPORT_MODE_SET.has(modeRaw)) {
    return toApiErrorResponse({ error: "Invalid transportMode.", code: "BAD_INPUT", status: 400 });
  }
  const mode = modeRaw as TariffTransportMode;

  const asOfStr = typeof o.asOf === "string" && o.asOf.trim() ? o.asOf.trim() : new Date().toISOString().slice(0, 10);
  const asOf = parseDate(asOfStr);
  if (!asOf) {
    return toApiErrorResponse({ error: "Invalid asOf date.", code: "BAD_INPUT", status: 400 });
  }

  if (o.providerIds != null && !Array.isArray(o.providerIds)) {
    return toApiErrorResponse({ error: "providerIds must be an array of strings when provided.", code: "BAD_INPUT", status: 400 });
  }
  const providerIds = Array.isArray(o.providerIds)
    ? o.providerIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : undefined;

  let maxResults: number | undefined;
  if (o.maxResults !== undefined && o.maxResults !== null) {
    if (typeof o.maxResults !== "number" || !Number.isFinite(o.maxResults)) {
      return toApiErrorResponse({ error: "maxResults must be a finite number when provided.", code: "BAD_INPUT", status: 400 });
    }
    maxResults = Math.min(Math.max(Math.floor(o.maxResults), 1), 50);
  }

  try {
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
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
