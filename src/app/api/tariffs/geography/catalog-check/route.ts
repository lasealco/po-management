import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  TARIFF_GEO_CATALOG_CHECK_MAX_CODES,
  classifyTariffUnlocsAgainstLocationCatalog,
  normalizeUnlocCodesForCatalogCheck,
} from "@/lib/tariff/geography-catalog";

export const dynamic = "force-dynamic";

/** POST { "codes": ["DEHAM","USCHI"] } — compares tariff-style UN/LOC codes to tenant LocationCode rows. */
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
  const codes = (body as { codes?: unknown }).codes;
  if (!Array.isArray(codes) || !codes.every((c) => typeof c === "string")) {
    return toApiErrorResponse({ error: "codes must be an array of strings.", code: "BAD_INPUT", status: 400 });
  }
  if (codes.length > 10_000) {
    return toApiErrorResponse({ error: "codes array is too large.", code: "BAD_INPUT", status: 400 });
  }

  const deduped = normalizeUnlocCodesForCatalogCheck(codes as string[]);
  if (deduped.length > TARIFF_GEO_CATALOG_CHECK_MAX_CODES) {
    return toApiErrorResponse({
      error: `After deduplication, at most ${TARIFF_GEO_CATALOG_CHECK_MAX_CODES} distinct codes are allowed per request.`,
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const result = await classifyTariffUnlocsAgainstLocationCatalog({
    tenantId: tenant.id,
    codes: deduped,
  });
  return NextResponse.json(result);
}
