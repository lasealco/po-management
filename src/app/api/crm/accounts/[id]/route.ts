import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function loadAccountForActor(
  tenantId: string,
  accountId: string,
  actorId: string,
) {
  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  return prisma.crmAccount.findFirst({
    where: {
      id: accountId,
      tenantId,
      ...(canEditAll ? {} : { ownerUserId: actorId }),
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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id } = await context.params;
  const account = await loadAccountForActor(tenant.id, id, actorId);
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await loadAccountForActor(tenant.id, id, actorId);
  if (!existing) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  if (!canEditAll && existing.ownerUserId !== actorId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
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

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const account = await prisma.crmAccount.update({
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
      updatedAt: true,
    },
  });

  return NextResponse.json({ account });
}
