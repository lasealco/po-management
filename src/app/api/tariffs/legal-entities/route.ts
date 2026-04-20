import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { createTariffLegalEntity, listTariffLegalEntitiesForTenant } from "@/lib/tariff/legal-entities";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor")?.trim() || undefined;
  const takeRaw = searchParams.get("take");
  const take = takeRaw ? Number(takeRaw) : undefined;
  const status = searchParams.get("status")?.trim() || undefined;

  const { items, nextCursor } = await listTariffLegalEntitiesForTenant({
    tenantId: tenant.id,
    take: take && Number.isFinite(take) ? take : undefined,
    cursor,
    status,
  });
  return NextResponse.json({ legalEntities: items, nextCursor });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "edit");
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
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });

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
