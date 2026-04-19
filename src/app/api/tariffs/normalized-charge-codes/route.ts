import { NextResponse } from "next/server";

import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import {
  createNormalizedChargeCode,
  listNormalizedChargeCodes,
  parseCreateNormalizedChargeCodeBody,
  toChargeCatalogRowJson,
} from "@/lib/tariff/normalized-charge-codes";
import { getActorUserId, requireApiGrant } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;
  try {
    const rows = await listNormalizedChargeCodes();
    return NextResponse.json({ chargeCodes: rows.map(toChargeCatalogRowJson) });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  try {
    const actorId = await getActorUserId();
    if (!actorId) {
      return NextResponse.json({ error: "No active user." }, { status: 403 });
    }
    const parsed = parseCreateNormalizedChargeCodeBody(body as Record<string, unknown>);
    const created = await createNormalizedChargeCode(parsed, { actorUserId: actorId });
    return NextResponse.json({ chargeCode: toChargeCatalogRowJson(created) });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
