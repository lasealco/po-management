import { TariffGeographyType } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { createTariffGeographyMember, listTariffGeographyMembersForGroup } from "@/lib/tariff/geography-members";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { parseTariffDateField } from "@/app/api/tariffs/_lib/parse-tariff-date";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<string>(Object.values(TariffGeographyType));

function parseGeographyType(v: unknown): TariffGeographyType | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return VALID_TYPES.has(t) ? (t as TariffGeographyType) : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const { id: geographyGroupId } = await context.params;
  try {
    const members = await listTariffGeographyMembersForGroup(geographyGroupId);
    return NextResponse.json({ members });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const { id: geographyGroupId } = await context.params;

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
  const memberCode = typeof o.memberCode === "string" ? o.memberCode.trim() : "";
  const memberType = parseGeographyType(o.memberType);
  if (!memberCode || !memberType) {
    return toApiErrorResponse({
      error: "memberCode and a valid memberType are required.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  try {
    const created = await createTariffGeographyMember({
      geographyGroupId,
      memberCode,
      memberName: typeof o.memberName === "string" ? o.memberName.trim() || null : null,
      memberType,
      validFrom: parseTariffDateField(o.validFrom) ?? null,
      validTo: parseTariffDateField(o.validTo) ?? null,
    });
    return NextResponse.json({ member: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
