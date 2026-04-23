import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { parseTariffLaneRatePostBody } from "@/app/api/tariffs/_lib/parse-tariff-lane-rate-post-body";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { rateTariffLane } from "@/lib/tariff/rating-engine";

export const dynamic = "force-dynamic";

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

  const parsed = parseTariffLaneRatePostBody(body);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: "BAD_INPUT", status: 400 });
  }
  const { pol, pod, equipment, asOf, transportMode, providerIds, maxResults } = parsed.value;

  try {
    const result = await rateTariffLane({
      tenantId: tenant.id,
      pol,
      pod,
      equipment,
      asOf,
      transportMode,
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
