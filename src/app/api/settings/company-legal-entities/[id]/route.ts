import { NextResponse } from "next/server";

import {
  assertMergedEffectiveDateRange,
  loadCompanyLegalEntityForActor,
  parsePatchCompanyLegalBody,
  serializeCompanyLegalEntity,
} from "@/lib/company-legal-entity";
import { recordCompanyLegalEntityAudit } from "@/lib/company-legal-audit";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user for this session.", code: "FORBIDDEN", status: 403 });
  }
  const { id } = await context.params;
  const row = await loadCompanyLegalEntityForActor(id, tenant.id, actorId);
  if (!row) {
    return toApiErrorResponse({ error: "Legal profile not found.", code: "NOT_FOUND", status: 404 });
  }
  return NextResponse.json({ companyLegalEntity: serializeCompanyLegalEntity(row) });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user for this session.", code: "FORBIDDEN", status: 403 });
  }
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }
  const parsed = parsePatchCompanyLegalBody(body);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: parsed.code, status: 400 });
  }

  const existing = await loadCompanyLegalEntityForActor(id, tenant.id, actorId);
  if (!existing) {
    return toApiErrorResponse({ error: "Legal profile not found.", code: "NOT_FOUND", status: 404 });
  }
  const range = assertMergedEffectiveDateRange(
    { effectiveFrom: existing.effectiveFrom, effectiveTo: existing.effectiveTo },
    parsed.value,
  );
  if (!range.ok) {
    return toApiErrorResponse({ error: range.error, code: "BAD_INPUT", status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.companyLegalEntity.update({
        where: { id, tenantId: tenant.id },
        data: parsed.value,
        include: { orgUnit: { select: { id: true, name: true, code: true, kind: true } } },
      });
      await recordCompanyLegalEntityAudit(tx, {
        tenantId: tenant.id,
        orgUnitId: row.orgUnitId,
        actorUserId: actorId,
        action: "UPDATE",
        companyLegalEntityId: id,
        metadata: { changedKeys: Object.keys(parsed.value) },
      });
      return row;
    });
    return NextResponse.json({ companyLegalEntity: serializeCompanyLegalEntity(updated) });
  } catch (e) {
    console.error("company-legal-entity patch", e);
    return toApiErrorResponse({ error: "Update failed.", code: "BAD_INPUT", status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user for this session.", code: "FORBIDDEN", status: 403 });
  }
  const { id } = await context.params;

  const existing = await loadCompanyLegalEntityForActor(id, tenant.id, actorId);
  if (!existing) {
    return toApiErrorResponse({ error: "Legal profile not found.", code: "NOT_FOUND", status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await recordCompanyLegalEntityAudit(tx, {
      tenantId: tenant.id,
      orgUnitId: existing.orgUnitId,
      actorUserId: actorId,
      action: "DELETE",
      companyLegalEntityId: id,
      metadata: {
        companyLegalEntityId: id,
        registeredLegalName: existing.registeredLegalName,
      },
    });
    await tx.companyLegalEntity.delete({
      where: { id, tenantId: tenant.id },
    });
  });
  return new NextResponse(null, { status: 204 });
}
