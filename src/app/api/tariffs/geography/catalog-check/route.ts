import { NextResponse } from "next/server";

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
  const codes = (body as { codes?: unknown }).codes;
  if (!Array.isArray(codes) || !codes.every((c) => typeof c === "string")) {
    return NextResponse.json({ error: "codes must be an array of strings." }, { status: 400 });
  }
  if (codes.length > 10_000) {
    return NextResponse.json({ error: "codes array is too large." }, { status: 400 });
  }

  const deduped = normalizeUnlocCodesForCatalogCheck(codes as string[]);
  if (deduped.length > TARIFF_GEO_CATALOG_CHECK_MAX_CODES) {
    return NextResponse.json(
      {
        error: `After deduplication, at most ${TARIFF_GEO_CATALOG_CHECK_MAX_CODES} distinct codes are allowed per request.`,
      },
      { status: 400 },
    );
  }

  const result = await classifyTariffUnlocsAgainstLocationCatalog({
    tenantId: tenant.id,
    codes: deduped,
  });
  return NextResponse.json(result);
}
