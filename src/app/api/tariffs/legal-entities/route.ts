import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { createTariffLegalEntity, listTariffLegalEntitiesForTenant } from "@/lib/tariff/legal-entities";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor")?.trim() || undefined;
  const takeRaw = searchParams.get("take");
  let take: number | undefined;
  if (takeRaw != null && takeRaw !== "") {
    const n = Number(takeRaw);
    if (!Number.isInteger(n) || n < 1) {
      return toApiErrorResponse({ error: "Query take must be a positive integer.", code: "BAD_INPUT", status: 400 });
    }
    take = n;
  }
  const status = searchParams.get("status")?.trim() || undefined;

  const { items, nextCursor } = await listTariffLegalEntitiesForTenant({
    tenantId: tenant.id,
    take,
    cursor,
    status,
  });
  return NextResponse.json({ legalEntities: items, nextCursor });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "edit");
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
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) {
    return toApiErrorResponse({ error: "name is required.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const row = await createTariffLegalEntity({
      tenantId: tenant.id,
      name,
      code: typeof o.code === "string" ? o.code : null,
      countryCode: typeof o.countryCode === "string" ? o.countryCode : null,
      baseCurrency: typeof o.baseCurrency === "string" ? o.baseCurrency : null,
      status: typeof o.status === "string" ? o.status : "ACTIVE",
    });
    return NextResponse.json({ legalEntity: row });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
