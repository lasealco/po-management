import { TariffGeographyType } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { deleteTariffGeographyMember, updateTariffGeographyMember } from "@/lib/tariff/geography-members";
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string; memberId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const { id: geographyGroupId, memberId } = await context.params;

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

  const memberType = parseGeographyType(o.memberType);
  if (o.memberType !== undefined && memberType === null) {
    return NextResponse.json({ error: "Invalid memberType." }, { status: 400 });
  }

  const patch: Parameters<typeof updateTariffGeographyMember>[1] = {};
  if (typeof o.memberCode === "string") {
    const c = o.memberCode.trim();
    if (!c) return NextResponse.json({ error: "memberCode cannot be empty." }, { status: 400 });
    patch.memberCode = c;
  }
  if (typeof o.memberName === "string") patch.memberName = o.memberName.trim() || null;
  if (o.memberName === null) patch.memberName = null;
  if (memberType != null) patch.memberType = memberType;
  if (o.validFrom !== undefined) patch.validFrom = parseTariffDateField(o.validFrom) ?? null;
  if (o.validTo !== undefined) patch.validTo = parseTariffDateField(o.validTo) ?? null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const updated = await updateTariffGeographyMember(memberId, patch, { geographyGroupId });
    return NextResponse.json({ member: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; memberId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const { id: geographyGroupId, memberId } = await context.params;
  try {
    await deleteTariffGeographyMember(memberId, { geographyGroupId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
