import { NextResponse } from "next/server";

import {
  canActorAccessOrgUnitForCompanyLegal,
  isOrgUnitKindLegalEntity,
  parseCreateCompanyLegalBody,
  serializeCompanyLegalEntity,
} from "@/lib/company-legal-entity";
import { getActorUserId, requireApiGrant, userIsSuperuser } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { orgUnitSubtreeIds } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

export async function GET() {
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

  const rows = await prisma.companyLegalEntity.findMany({
    where: { tenantId: tenant.id },
    include: { orgUnit: { select: { id: true, name: true, code: true, kind: true } } },
    orderBy: [{ registeredLegalName: "asc" }, { id: "asc" }],
  });

  let filtered = rows;
  if (!(await userIsSuperuser(actorId))) {
    const user = await prisma.user.findFirst({
      where: { id: actorId, tenantId: tenant.id, isActive: true },
      select: { primaryOrgUnitId: true },
    });
    if (user?.primaryOrgUnitId) {
      const orgRows = await prisma.orgUnit.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, parentId: true },
      });
      const sub = new Set(orgUnitSubtreeIds(orgRows, user.primaryOrgUnitId));
      filtered = rows.filter((r) => sub.has(r.orgUnitId));
    }
  }

  return NextResponse.json({
    companyLegalEntities: filtered.map(serializeCompanyLegalEntity),
  });
}

export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const parsed = parseCreateCompanyLegalBody(body);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: parsed.code, status: 400 });
  }
  const data = parsed.value;

  const allowed = await canActorAccessOrgUnitForCompanyLegal(actorId, tenant.id, data.orgUnitId);
  if (!allowed) {
    return toApiErrorResponse({
      error: "You cannot create a legal profile for this org unit (outside your scope).",
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const org = await prisma.orgUnit.findFirst({
    where: { id: data.orgUnitId, tenantId: tenant.id },
    select: { id: true, kind: true },
  });
  if (!org) {
    return toApiErrorResponse({ error: "org unit not found in this tenant.", code: "BAD_INPUT", status: 400 });
  }
  if (!isOrgUnitKindLegalEntity(org.kind)) {
    return toApiErrorResponse({
      error: "org unit kind must be LEGAL_ENTITY to attach a company legal profile.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const existing = await prisma.companyLegalEntity.findFirst({
    where: { orgUnitId: data.orgUnitId, tenantId: tenant.id },
    select: { id: true },
  });
  if (existing) {
    return toApiErrorResponse({
      error: "A legal profile already exists for this org unit. Use PATCH to update it.",
      code: "CONFLICT",
      status: 409,
    });
  }

  try {
    const created = await prisma.companyLegalEntity.create({
      data: {
        tenantId: tenant.id,
        orgUnitId: data.orgUnitId,
        registeredLegalName: data.registeredLegalName,
        tradeName: data.tradeName,
        taxVatId: data.taxVatId,
        taxLocalId: data.taxLocalId,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        addressCity: data.addressCity,
        addressRegion: data.addressRegion,
        addressPostalCode: data.addressPostalCode,
        addressCountryCode: data.addressCountryCode,
        phone: data.phone,
        companyEmail: data.companyEmail,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        status: data.status,
      },
      include: { orgUnit: { select: { id: true, name: true, code: true, kind: true } } },
    });
    return NextResponse.json({ companyLegalEntity: serializeCompanyLegalEntity(created) });
  } catch (e) {
    console.error("company-legal-entity create", e);
    return toApiErrorResponse({
      error: "Could not create legal profile (duplicate or invalid data).",
      code: "BAD_INPUT",
      status: 400,
    });
  }
}
