import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant, userIsSuperuser } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { orgUnitSubtreeIds } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";

const TAKE = 100;

/**
 * Append-only history for company legal profile changes (Phase 5 write / Phase 6 read).
 * Scoped to the actor’s org subtree when `User.primaryOrgUnitId` is set (same as company legal list).
 */
export async function GET() {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user for this session.", code: "FORBIDDEN", status: 403 });
  }

  const orgFilter: { orgUnitId?: { in: string[] } } = {};
  if (!(await userIsSuperuser(actorId))) {
    const user = await prisma.user.findFirst({
      where: { id: actorId, tenantId: tenant.id, isActive: true },
      select: { primaryOrgUnitId: true },
    });
    if (user?.primaryOrgUnitId) {
      const all = await prisma.orgUnit.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, parentId: true },
      });
      const inScope = new Set(orgUnitSubtreeIds(all, user.primaryOrgUnitId));
      orgFilter.orgUnitId = { in: [...inScope] };
    }
  }

  const rows = await prisma.companyLegalEntityAuditLog.findMany({
    where: { tenantId: tenant.id, ...orgFilter },
    orderBy: { createdAt: "desc" },
    take: TAKE,
    include: {
      orgUnit: { select: { id: true, name: true, code: true, kind: true } },
      actor: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({
    entries: rows.map((e) => ({
      id: e.id,
      action: e.action,
      createdAt: e.createdAt.toISOString(),
      orgUnit: e.orgUnit,
      companyLegalEntityId: e.companyLegalEntityId,
      metadata: e.metadata,
      actor: { id: e.actor.id, email: e.actor.email, name: e.actor.name },
    })),
  });
}
