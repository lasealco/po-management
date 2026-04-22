import type { CrmOpportunityStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import {
  buildInvalidStageMessage,
  isCrmOpportunityStage,
  validateOpportunityStageChange,
} from "@/lib/crm/opportunity-stage-change";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await context.params;
  const opportunity = await loadOpportunity(tenant.id, id, actorId);
  if (!opportunity) {
    return toApiErrorResponse({ error: "Opportunity not found.", code: "NOT_FOUND", status: 404 });
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
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await context.params;
  const existing = await loadOpportunity(tenant.id, id, actorId);
  if (!existing) {
    return toApiErrorResponse({ error: "Opportunity not found.", code: "NOT_FOUND", status: 404 });
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
  if (body.stage !== undefined) {
    if (!isCrmOpportunityStage(body.stage)) {
      return toApiErrorResponse({ error: buildInvalidStageMessage(body.stage), code: "BAD_INPUT", status: 400 });
    }
    const stageValidation = validateOpportunityStageChange(existing.stage, body.stage);
    if (!stageValidation.ok) {
      return toApiErrorResponse({ error: stageValidation.error, code: "BAD_INPUT", status: 400 });
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
        return toApiErrorResponse({ error: "Contact not found on this account.", code: "BAD_INPUT", status: 400 });
      }
      data.primaryContactId = cid;
    } else {
      data.primaryContactId = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No fields to update.", code: "BAD_INPUT", status: 400 });
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
