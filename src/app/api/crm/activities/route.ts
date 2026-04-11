import type { CrmActivityType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { crmTenantFilter } from "@/lib/crm-scope";
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

function parseType(raw: string | undefined): CrmActivityType {
  if (raw && TYPES.includes(raw as CrmActivityType)) {
    return raw as CrmActivityType;
  }
  return "TASK";
}

export async function GET() {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const scope = await crmTenantFilter(tenant.id, actorId);
  const where =
    "ownerUserId" in scope && scope.ownerUserId
      ? { tenantId: tenant.id, ownerUserId: scope.ownerUserId }
      : { tenantId: tenant.id };

  const activities = await prisma.crmActivity.findMany({
    where,
    orderBy: { dueDate: "asc" },
    take: 200,
    select: {
      id: true,
      type: true,
      subject: true,
      status: true,
      dueDate: true,
      relatedAccountId: true,
      relatedOpportunityId: true,
      owner: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ activities });
}

type PostBody = {
  type?: string;
  subject?: string;
  body?: string | null;
  dueDate?: string | null;
  relatedAccountId?: string | null;
  relatedContactId?: string | null;
  relatedOpportunityId?: string | null;
};

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  if (!subject) {
    return NextResponse.json({ error: "subject is required." }, { status: 400 });
  }

  const activity = await prisma.crmActivity.create({
    data: {
      tenantId: tenant.id,
      ownerUserId: actorId,
      type: parseType(body.type),
      subject,
      body: body.body?.trim() || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      relatedAccountId: body.relatedAccountId?.trim() || null,
      relatedContactId: body.relatedContactId?.trim() || null,
      relatedOpportunityId: body.relatedOpportunityId?.trim() || null,
    },
    select: {
      id: true,
      type: true,
      subject: true,
      dueDate: true,
    },
  });

  return NextResponse.json({ activity }, { status: 201 });
}
