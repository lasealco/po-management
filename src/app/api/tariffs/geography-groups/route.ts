import { TariffGeographyType } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
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

export async function GET() {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const groups = await listTariffGeographyGroups({ take: 500 });
  return NextResponse.json({ groups });
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
  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const geographyType = parseGeographyType(o.geographyType);
  if (!name || !geographyType) {
    return NextResponse.json({ error: "name and a valid geographyType are required." }, { status: 400 });
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
    return NextResponse.json({ group: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
