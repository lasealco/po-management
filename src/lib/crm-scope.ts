import type { Prisma } from "@prisma/client";

import { userIsSuperuser } from "@/lib/authz";
import { loadOrgUnitSubtreeIds } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";

/**
 * How far CRM list/detail reads extend for the actor. Matches org/division intent from
 * purchase-order scope, but applied to **record owner** (User behind `ownerUserId`).
 */
export type CrmAccessScope =
  | { mode: "tenant" }
  | { mode: "ownerScoped"; ownerWhere: Prisma.UserWhereInput };

/**
 * Superusers: no owner filter. Other users: owners whose `User` row matches the actor’s
 * org subtree (lenient: owner’s `primaryOrgUnitId` null) and, when the actor has product
 * divisions, at least one overlapping `UserProductDivision` (lenient: owner has no division links).
 * Users with neither primary org nor division links: no extra filter (same as PO when neither set).
 */
export async function getCrmOwnerUserScopeWhere(
  tenantId: string,
  actorUserId: string,
): Promise<Prisma.UserWhereInput | undefined> {
  if (await userIsSuperuser(actorUserId)) {
    return undefined;
  }
  const user = await prisma.user.findFirst({
    where: { id: actorUserId, tenantId, isActive: true },
    select: {
      primaryOrgUnitId: true,
      productDivisionScope: { select: { productDivisionId: true } },
    },
  });
  if (!user) {
    return { id: { equals: "___no_crm_access___" } } satisfies Prisma.UserWhereInput;
  }
  const divIds = user.productDivisionScope.map((s) => s.productDivisionId);
  const orgId = user.primaryOrgUnitId;
  const parts: Prisma.UserWhereInput[] = [];
  if (orgId) {
    const subtree = await loadOrgUnitSubtreeIds(tenantId, orgId);
    parts.push({
      OR: [
        { primaryOrgUnitId: { in: subtree } },
        { primaryOrgUnitId: null },
      ],
    });
  }
  if (divIds.length > 0) {
    parts.push({
      OR: [
        { productDivisionScope: { some: { productDivisionId: { in: divIds } } } },
        { productDivisionScope: { none: {} } },
      ],
    });
  }
  if (parts.length === 0) {
    return undefined;
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  return { AND: parts };
}

export async function getCrmAccessScope(
  tenantId: string,
  actorUserId: string,
): Promise<CrmAccessScope> {
  const w = await getCrmOwnerUserScopeWhere(tenantId, actorUserId);
  if (w === undefined) {
    return { mode: "tenant" };
  }
  return { mode: "ownerScoped", ownerWhere: w };
}

/** Reusable for Prisma `where` on models with an `owner` → User relation. */
export function crmOwnerRelationClause(
  scope: CrmAccessScope,
): { owner: { is: Prisma.UserWhereInput } } | Record<string, never> {
  if (scope.mode === "tenant") {
    return {};
  }
  return { owner: { is: scope.ownerWhere } };
}

/**
 * `where: { is: { ... } }` for nested `CrmAccount` (e.g. `contact.account`).
 */
export function crmAccountInScope(
  tenantId: string,
  scope: CrmAccessScope,
): Prisma.CrmAccountWhereInput {
  return {
    tenantId,
    ...crmOwnerRelationClause(scope),
  };
}
