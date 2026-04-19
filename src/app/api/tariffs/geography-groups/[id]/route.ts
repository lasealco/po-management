import { TariffGeographyType } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import {
  deleteTariffGeographyGroup,
  getTariffGeographyGroupById,
  updateTariffGeographyGroup,
} from "@/lib/tariff/geography-groups";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { parseTariffDateField } from "@/app/api/tariffs/_lib/parse-tariff-date";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<string>(Object.values(TariffGeographyType));

function parseGeographyType(v: unknown): TariffGeographyType | null | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return VALID_TYPES.has(t) ? (t as TariffGeographyType) : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const { id } = await context.params;
  try {
    const group = await getTariffGeographyGroupById(id);
    return NextResponse.json({ group });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

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

  const geographyType = parseGeographyType(o.geographyType);
  if (o.geographyType !== undefined && geographyType === null) {
    return NextResponse.json({ error: "Invalid geographyType." }, { status: 400 });
  }

  const patch: Parameters<typeof updateTariffGeographyGroup>[1] = {};
  if (geographyType != null) patch.geographyType = geographyType;
  if (typeof o.name === "string") {
    const n = o.name.trim();
    if (!n) return NextResponse.json({ error: "name cannot be empty." }, { status: 400 });
    patch.name = n;
  }
  if (typeof o.code === "string") patch.code = o.code.trim() || null;
  if (o.code === null) patch.code = null;
  if (typeof o.aliasSource === "string") patch.aliasSource = o.aliasSource.trim() || null;
  if (o.aliasSource === null) patch.aliasSource = null;
  if (o.validFrom !== undefined) patch.validFrom = parseTariffDateField(o.validFrom) ?? null;
  if (o.validTo !== undefined) patch.validTo = parseTariffDateField(o.validTo) ?? null;
  if (typeof o.active === "boolean") patch.active = o.active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const updated = await updateTariffGeographyGroup(id, patch);
    return NextResponse.json({ group: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const { id } = await context.params;
  try {
    await deleteTariffGeographyGroup(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
