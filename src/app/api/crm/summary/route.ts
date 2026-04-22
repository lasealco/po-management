import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { crmTenantFilter } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const scope = await crmTenantFilter(tenant.id, actorId);
  const ownerClause =
    "ownerUserId" in scope && scope.ownerUserId
      ? { ownerUserId: scope.ownerUserId }
      : {};

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const now = new Date();

  const [
    leadCount,
    accountCount,
    opportunityCount,
    openActivityCount,
    openQuoteCount,
    staleOpportunityCount,
    overdueActivityCount,
  ] = await Promise.all([
    prisma.crmLead.count({ where: { tenantId: tenant.id, ...ownerClause } }),
    prisma.crmAccount.count({ where: { tenantId: tenant.id, ...ownerClause } }),
    prisma.crmOpportunity.count({
      where: {
        tenantId: tenant.id,
        ...ownerClause,
        stage: { notIn: ["LOST", "WON_LIVE"] },
      },
    }),
    prisma.crmActivity.count({
      where: {
        tenantId: tenant.id,
        ...ownerClause,
        status: { not: "DONE" },
      },
    }),
    prisma.crmQuote.count({
      where: {
        tenantId: tenant.id,
        ...ownerClause,
        status: { in: ["DRAFT", "SENT"] },
      },
    }),
    prisma.crmOpportunity.count({
      where: {
        tenantId: tenant.id,
        ...ownerClause,
        stage: { notIn: ["LOST", "WON_LIVE"] },
        OR: [
          { closeDate: { lt: startOfToday } },
          { nextStepDate: { lt: startOfToday } },
        ],
      },
    }),
    prisma.crmActivity.count({
      where: {
        tenantId: tenant.id,
        ...ownerClause,
        status: { notIn: ["DONE", "CANCELLED"] },
        dueDate: { lt: now },
      },
    }),
  ]);

  return NextResponse.json({
    leads: leadCount,
    accounts: accountCount,
    openOpportunities: opportunityCount,
    openActivities: openActivityCount,
    openQuotes: openQuoteCount,
    staleOpportunities: staleOpportunityCount,
    overdueActivities: overdueActivityCount,
  });
}
