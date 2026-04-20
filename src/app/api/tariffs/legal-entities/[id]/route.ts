import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { updateTariffLegalEntity } from "@/lib/tariff/legal-entities";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id } = await context.params;

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

  const patch: Parameters<typeof updateTariffLegalEntity>[1] = {};
  if (typeof o.name === "string") patch.name = o.name;
  if (typeof o.code === "string" || o.code === null) patch.code = o.code as string | null;
  if (typeof o.countryCode === "string" || o.countryCode === null) patch.countryCode = o.countryCode as string | null;
  if (typeof o.baseCurrency === "string" || o.baseCurrency === null) patch.baseCurrency = o.baseCurrency as string | null;
  if (typeof o.status === "string") patch.status = o.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const row = await updateTariffLegalEntity({ tenantId: tenant.id, id }, patch);
    return NextResponse.json({ legalEntity: row });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
