import { TariffGeographyType } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { createTariffGeographyGroup, listTariffGeographyGroups } from "@/lib/tariff/geography-groups";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { parseTariffDateField } from "@/app/api/tariffs/_lib/parse-tariff-date";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<string>(Object.values(TariffGeographyType));

function parseGeographyType(v: unknown): TariffGeographyType | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return VALID_TYPES.has(t) ? (t as TariffGeographyType) : null;
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const url = new URL(request.url);
  let take = 500;
  try {
    const raw = url.searchParams.get("take");
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        return toApiErrorResponse({ error: "Query take must be a positive integer.", code: "BAD_INPUT", status: 400 });
      }
      take = Math.min(n, 500);
    }
  } catch {
    /* default */
  }
  const activeOnlyRaw = url.searchParams.get("activeOnly");
  const activeOnly =
    activeOnlyRaw === "1" || activeOnlyRaw === "true" || activeOnlyRaw === "yes";

  const groups = await listTariffGeographyGroups({ take, activeOnly });
  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
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
  const geographyType = parseGeographyType(o.geographyType);
  if (!name || !geographyType) {
    return toApiErrorResponse({
      error: "name and a valid geographyType are required.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  try {
    const created = await createTariffGeographyGroup({
      geographyType,
      name,
      code: typeof o.code === "string" ? o.code.trim() || null : null,
      aliasSource: typeof o.aliasSource === "string" ? o.aliasSource.trim() || null : null,
      validFrom: parseTariffDateField(o.validFrom) ?? null,
      validTo: parseTariffDateField(o.validTo) ?? null,
      active: typeof o.active === "boolean" ? o.active : true,
    });
    await recordTariffAuditLog({
      objectType: "geography_group",
      objectId: created.id,
      action: "create",
      userId: actorId,
      newValue: {
        name: created.name,
        geographyType: created.geographyType,
        code: created.code,
        active: created.active,
      },
    });
    return NextResponse.json({ group: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
