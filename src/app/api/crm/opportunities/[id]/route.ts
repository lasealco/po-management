import type { CrmOpportunityStage } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STAGES: CrmOpportunityStage[] = [
  "IDENTIFIED",
  "QUALIFIED",
  "DISCOVERY",
  "SOLUTION_DESIGN",
  "PROPOSAL_SUBMITTED",
  "NEGOTIATION",
  "VERBAL_AGREEMENT",
  "WON_IMPLEMENTATION_PENDING",
  "WON_LIVE",
  "LOST",
  "ON_HOLD",
];

async function loadOpportunity(tenantId: string, oppId: string, actorId: string) {
  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  return prisma.crmOpportunity.findFirst({
    where: {
      id: oppId,
      tenantId,
      ...(canEditAll ? {} : { ownerUserId: actorId }),
    },
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      primaryContact: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
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
  const opportunity = await loadOpportunity(tenant.id, id, actorId);
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }

  const activities = await prisma.crmActivity.findMany({
    where: { tenantId: tenant.id, relatedOpportunityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      type: true,
      subject: true,
      status: true,
      dueDate: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ opportunity, activities });
}

type PatchBody = {
  name?: string;
  stage?: CrmOpportunityStage;
  probability?: number;
  forecastCategory?: string | null;
  estimatedRevenue?: string | number | null;
  estimatedNetRevenue?: string | number | null;
  currency?: string | null;
  closeDate?: string | null;
  nextStep?: string | null;
  nextStepDate?: string | null;
  primaryContactId?: string | null;
  competitorName?: string | null;
  lostReason?: string | null;
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
  const existing = await loadOpportunity(tenant.id, id, actorId);
  if (!existing) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
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
  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage)) {
      return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
    }
    data.stage = body.stage;
  }
  if (body.probability !== undefined) {
    data.probability = Math.min(100, Math.max(0, Math.round(body.probability)));
  }
  if (body.forecastCategory !== undefined) {
    data.forecastCategory = body.forecastCategory?.trim() || null;
  }
  if (body.estimatedRevenue !== undefined) {
    data.estimatedRevenue =
      body.estimatedRevenue === null || body.estimatedRevenue === ""
        ? null
        : String(body.estimatedRevenue);
  }
  if (body.estimatedNetRevenue !== undefined) {
    data.estimatedNetRevenue =
      body.estimatedNetRevenue === null || body.estimatedNetRevenue === ""
        ? null
        : String(body.estimatedNetRevenue);
  }
  if (body.currency !== undefined) data.currency = body.currency?.trim().toUpperCase() || null;
  if (body.closeDate !== undefined) {
    data.closeDate = body.closeDate ? new Date(body.closeDate) : null;
  }
  if (body.nextStep !== undefined) data.nextStep = body.nextStep?.trim() || null;
  if (body.nextStepDate !== undefined) {
    data.nextStepDate = body.nextStepDate ? new Date(body.nextStepDate) : null;
  }
  if (body.competitorName !== undefined) {
    data.competitorName = body.competitorName?.trim() || null;
  }
  if (body.lostReason !== undefined) data.lostReason = body.lostReason?.trim() || null;

  if (body.primaryContactId !== undefined) {
    const cid = body.primaryContactId?.trim() || null;
    if (cid) {
      const c = await prisma.crmContact.findFirst({
        where: {
          id: cid,
          tenantId: tenant.id,
          accountId: existing.accountId,
        },
        select: { id: true },
      });
      if (!c) {
        return NextResponse.json(
          { error: "Contact not found on this account." },
          { status: 400 },
        );
      }
      data.primaryContactId = cid;
    } else {
      data.primaryContactId = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const opportunity = await prisma.crmOpportunity.update({
    where: { id },
    data: data as never,
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      primaryContact: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return NextResponse.json({ opportunity });
}
