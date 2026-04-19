import { NextResponse } from "next/server";

import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import {
  parsePatchNormalizedChargeCodeBody,
  toChargeCatalogRowJson,
  updateNormalizedChargeCode,
} from "@/lib/tariff/normalized-charge-codes";
import { getActorUserId, requireApiGrant } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;
  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id." }, { status: 400 });

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
    const patch = parsePatchNormalizedChargeCodeBody(body as Record<string, unknown>);
    const updated = await updateNormalizedChargeCode({ id: id.trim(), actorUserId: actorId }, patch);
    return NextResponse.json({ chargeCode: toChargeCatalogRowJson(updated) });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
