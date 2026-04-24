import type { CrmOpportunityStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { crmOwnerRelationClause, getCrmAccessScope } from "@/lib/crm-scope";
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
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const scope = await getCrmAccessScope(tenant.id, actorId);
  const where = { tenantId: tenant.id, ...crmOwnerRelationClause(scope) };

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
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const accountId = body.accountId?.trim();
  const name = body.name?.trim();
  if (!accountId || !name) {
    return toApiErrorResponse({ error: "accountId and name are required.", code: "BAD_INPUT", status: 400 });
  }

  const scope = await getCrmAccessScope(tenant.id, actorId);
  const account = await prisma.crmAccount.findFirst({
    where: {
      id: accountId,
      tenantId: tenant.id,
      ...crmOwnerRelationClause(scope),
    },
    select: { id: true },
  });
  if (!account) {
    return toApiErrorResponse({ error: "Account not found.", code: "NOT_FOUND", status: 404 });
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
