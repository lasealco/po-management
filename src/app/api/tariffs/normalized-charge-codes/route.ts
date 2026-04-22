import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import {
  createNormalizedChargeCode,
  listNormalizedChargeCodes,
  parseCreateNormalizedChargeCodeBody,
  toChargeCatalogRowJson,
} from "@/lib/tariff/normalized-charge-codes";
import { getActorUserId, requireApiGrant } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;
  let take: number | undefined;
  try {
    const raw = new URL(request.url).searchParams.get("take");
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        return toApiErrorResponse({ error: "Query take must be a positive integer.", code: "BAD_INPUT", status: 400 });
      }
      take = n;
    }
  } catch {
    /* use default take from listNormalizedChargeCodes */
  }
  try {
    const rows = await listNormalizedChargeCodes(take != null ? { take } : undefined);
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
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  try {
    const actorId = await getActorUserId();
    if (!actorId) {
      return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
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
