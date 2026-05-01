import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { crmAccountInScope, getCrmAccessScope } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function loadAccountForActor(
  tenantId: string,
  accountId: string,
  actorId: string,
) {
  const scope = await getCrmAccessScope(tenantId, actorId);
  return prisma.crmAccount.findFirst({
    where: {
      id: accountId,
      ...crmAccountInScope(tenantId, scope),
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await context.params;
  const accountRow = await loadAccountForActor(tenant.id, id, actorId);
  if (!accountRow) {
    return toApiErrorResponse({ error: "Account not found.", code: "NOT_FOUND", status: 404 });
  }

  const account = {
    ...accountRow,
    mapLatitude: accountRow.mapLatitude != null ? accountRow.mapLatitude.toString() : null,
    mapLongitude: accountRow.mapLongitude != null ? accountRow.mapLongitude.toString() : null,
  };

  const [contacts, opportunities, activities, quotes] = await Promise.all([
    prisma.crmContact.findMany({
      where: { tenantId: tenant.id, accountId: id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        decisionRole: true,
      },
    }),
    prisma.crmOpportunity.findMany({
      where: { tenantId: tenant.id, accountId: id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        stage: true,
        probability: true,
        closeDate: true,
        nextStep: true,
      },
    }),
    prisma.crmActivity.findMany({
      where: { tenantId: tenant.id, relatedAccountId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        subject: true,
        status: true,
        dueDate: true,
        createdAt: true,
      },
    }),
    prisma.crmQuote.findMany({
      where: { tenantId: tenant.id, accountId: id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        quoteNumber: true,
        subtotal: true,
        validUntil: true,
        updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    account,
    contacts,
    opportunities,
    activities,
    quotes,
  });
}

type PatchBody = {
  name?: string;
  legalName?: string | null;
  website?: string | null;
  industry?: string | null;
  segment?: string | null;
  strategicFlag?: boolean;
  lifecycle?: "ACTIVE" | "INACTIVE";
  accountType?: "CUSTOMER" | "PROSPECT" | "PARTNER" | "AGENT" | "OTHER";
  /** BF-19 — WGS84 °; omit fields to leave unchanged; both `null` clears map pin. */
  mapLatitude?: number | null;
  mapLongitude?: number | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await context.params;
  const existing = await loadAccountForActor(tenant.id, id, actorId);
  if (!existing) {
    return toApiErrorResponse({ error: "Account not found.", code: "NOT_FOUND", status: 404 });
  }

  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  if (!canEditAll && existing.ownerUserId !== actorId) {
    return toApiErrorResponse({ error: "Forbidden.", code: "FORBIDDEN", status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.legalName !== undefined) data.legalName = body.legalName?.trim() || null;
  if (body.website !== undefined) data.website = body.website?.trim() || null;
  if (body.industry !== undefined) data.industry = body.industry?.trim() || null;
  if (body.segment !== undefined) data.segment = body.segment?.trim() || null;
  if (body.strategicFlag !== undefined) data.strategicFlag = Boolean(body.strategicFlag);
  if (body.lifecycle !== undefined) data.lifecycle = body.lifecycle;
  if (body.accountType !== undefined) data.accountType = body.accountType;

  const hasGeoLat = body.mapLatitude !== undefined;
  const hasGeoLng = body.mapLongitude !== undefined;
  if (hasGeoLat !== hasGeoLng) {
    return toApiErrorResponse({
      error: "mapLatitude and mapLongitude must be updated together (or both omitted).",
      code: "BAD_INPUT",
      status: 400,
    });
  }
  if (hasGeoLat && hasGeoLng) {
    if (body.mapLatitude === null && body.mapLongitude === null) {
      data.mapLatitude = null;
      data.mapLongitude = null;
    } else {
      const lat = typeof body.mapLatitude === "number" ? body.mapLatitude : Number(body.mapLatitude);
      const lng = typeof body.mapLongitude === "number" ? body.mapLongitude : Number(body.mapLongitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return toApiErrorResponse({
          error: "mapLatitude and mapLongitude must be finite numbers (or both null to clear).",
          code: "BAD_INPUT",
          status: 400,
        });
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return toApiErrorResponse({
          error: "Coordinates out of range (lat −90…90, lng −180…180).",
          code: "BAD_INPUT",
          status: 400,
        });
      }
      data.mapLatitude = new Prisma.Decimal(String(lat));
      data.mapLongitude = new Prisma.Decimal(String(lng));
    }
  }

  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No fields to update.", code: "BAD_INPUT", status: 400 });
  }

  const accountRow = await prisma.crmAccount.update({
    where: { id },
    data: data as never,
    select: {
      id: true,
      name: true,
      legalName: true,
      website: true,
      accountType: true,
      lifecycle: true,
      industry: true,
      segment: true,
      strategicFlag: true,
      ownerUserId: true,
      mapLatitude: true,
      mapLongitude: true,
      updatedAt: true,
    },
  });

  const account = {
    ...accountRow,
    mapLatitude: accountRow.mapLatitude != null ? accountRow.mapLatitude.toString() : null,
    mapLongitude: accountRow.mapLongitude != null ? accountRow.mapLongitude.toString() : null,
  };

  return NextResponse.json({ account });
}
