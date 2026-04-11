import { NextResponse } from "next/server";

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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const scope = await crmTenantFilter(tenant.id, actorId);
  const ownerClause =
    "ownerUserId" in scope && scope.ownerUserId
      ? { ownerUserId: scope.ownerUserId }
      : {};

  const [leadCount, accountCount, opportunityCount, openActivityCount] =
    await Promise.all([
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
    ]);

  return NextResponse.json({
    leads: leadCount,
    accounts: accountCount,
    openOpportunities: opportunityCount,
    openActivities: openActivityCount,
  });
}
