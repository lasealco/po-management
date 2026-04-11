import type { CrmOpportunityStage } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { crmTenantFilter } from "@/lib/crm-scope";
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

function parseStage(raw: string | undefined): CrmOpportunityStage {
  if (raw && STAGES.includes(raw as CrmOpportunityStage)) {
    return raw as CrmOpportunityStage;
  }
  return "IDENTIFIED";
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

  const opportunities = await prisma.crmOpportunity.findMany({
    where,
    orderBy: { closeDate: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      stage: true,
      probability: true,
      estimatedRevenue: true,
      currency: true,
      closeDate: true,
      nextStep: true,
      nextStepDate: true,
      ownerUserId: true,
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ opportunities });
}

type PostBody = {
  accountId?: string;
  name?: string;
  stage?: string;
  probability?: number;
  closeDate?: string | null;
  nextStep?: string | null;
  estimatedRevenue?: string | number | null;
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

  const accountId = body.accountId?.trim();
  const name = body.name?.trim();
  if (!accountId || !name) {
    return NextResponse.json(
      { error: "accountId and name are required." },
      { status: 400 },
    );
  }

  const account = await prisma.crmAccount.findFirst({
    where: { id: accountId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const scope = await crmTenantFilter(tenant.id, actorId);
  if ("ownerUserId" in scope && scope.ownerUserId) {
    const owns = await prisma.crmAccount.findFirst({
      where: { id: accountId, tenantId: tenant.id, ownerUserId: actorId },
      select: { id: true },
    });
    if (!owns) {
      return NextResponse.json(
        { error: "You can only add opportunities for accounts you own." },
        { status: 403 },
      );
    }
  }

  const opportunity = await prisma.crmOpportunity.create({
    data: {
      tenantId: tenant.id,
      accountId,
      ownerUserId: actorId,
      name,
      stage: parseStage(body.stage),
      probability:
        typeof body.probability === "number"
          ? Math.min(100, Math.max(0, body.probability))
          : 10,
      closeDate: body.closeDate ? new Date(body.closeDate) : null,
      nextStep: body.nextStep?.trim() || null,
      estimatedRevenue:
        body.estimatedRevenue != null && body.estimatedRevenue !== ""
          ? String(body.estimatedRevenue)
          : null,
      currency: "USD",
    },
    select: {
      id: true,
      name: true,
      stage: true,
      accountId: true,
      ownerUserId: true,
    },
  });

  return NextResponse.json({ opportunity }, { status: 201 });
}
