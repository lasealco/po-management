import type { CrmActivityType } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TYPES: CrmActivityType[] = [
  "TASK",
  "CALL",
  "MEETING",
  "NOTE",
  "EMAIL",
];

async function loadActivity(tenantId: string, activityId: string, actorId: string) {
  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  return prisma.crmActivity.findFirst({
    where: {
      id: activityId,
      tenantId,
      ...(canEditAll ? {} : { ownerUserId: actorId }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      relatedAccount: { select: { id: true, name: true } },
      relatedOpportunity: { select: { id: true, name: true } },
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
  const activity = await loadActivity(tenant.id, id, actorId);
  if (!activity) {
    return toApiErrorResponse({ error: "Activity not found.", code: "NOT_FOUND", status: 404 });
  }

  return NextResponse.json({ activity });
}

type PatchBody = {
  type?: CrmActivityType;
  subject?: string;
  body?: string | null;
  status?: string;
  dueDate?: string | null;
  relatedAccountId?: string | null;
  relatedOpportunityId?: string | null;
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
  const existing = await loadActivity(tenant.id, id, actorId);
  if (!existing) {
    return toApiErrorResponse({ error: "Activity not found.", code: "NOT_FOUND", status: 404 });
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
  if (body.type !== undefined) {
    if (!TYPES.includes(body.type)) {
      return toApiErrorResponse({ error: "Invalid type.", code: "BAD_INPUT", status: 400 });
    }
    data.type = body.type;
  }
  if (body.subject !== undefined) data.subject = body.subject.trim();
  if (body.body !== undefined) data.body = body.body?.trim() || null;
  if (body.status !== undefined) data.status = body.status.trim() || "OPEN";
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }

  if (body.relatedAccountId !== undefined) {
    const aid = body.relatedAccountId?.trim() || null;
    if (aid) {
      const acc = await prisma.crmAccount.findFirst({
        where: { id: aid, tenantId: tenant.id },
        select: { id: true },
      });
      if (!acc) {
        return toApiErrorResponse({ error: "Account not found.", code: "BAD_INPUT", status: 400 });
      }
    }
    data.relatedAccountId = aid;
  }

  if (body.relatedOpportunityId !== undefined) {
    const oid = body.relatedOpportunityId?.trim() || null;
    if (oid) {
      const opp = await prisma.crmOpportunity.findFirst({
        where: { id: oid, tenantId: tenant.id },
        select: { id: true },
      });
      if (!opp) {
        return toApiErrorResponse({ error: "Opportunity not found.", code: "BAD_INPUT", status: 400 });
      }
    }
    data.relatedOpportunityId = oid;
  }

  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No fields to update.", code: "BAD_INPUT", status: 400 });
  }

  const activity = await prisma.crmActivity.update({
    where: { id },
    data: data as never,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      relatedAccount: { select: { id: true, name: true } },
      relatedOpportunity: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ activity });
}
