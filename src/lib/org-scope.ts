import type { Prisma } from "@prisma/client";

import { userIsSuperuser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/**
 * In-memory subtree (self + descendants) for a root org unit. Caller loads all org rows for the tenant.
 */
export function orgUnitSubtreeIds(
  rows: { id: string; parentId: string | null }[],
  rootId: string,
): string[] {
  const byParent = new Map<string | null, string[]>();
  for (const r of rows) {
    const p = r.parentId;
    const list = byParent.get(p) ?? [];
    list.push(r.id);
    byParent.set(p, list);
  }
  const out: string[] = [];
  const stack = [rootId];
  for (let i = 0; i < 10_000 && stack.length; i += 1) {
    const id = stack.pop()!;
    out.push(id);
    for (const c of byParent.get(id) ?? []) stack.push(c);
  }
  return out;
}

export async function loadOrgUnitSubtreeIds(
  tenantId: string,
  rootOrgUnitId: string,
): Promise<string[]> {
  const all = await prisma.orgUnit.findMany({
    where: { tenantId },
    select: { id: true, parentId: true },
  });
  return orgUnitSubtreeIds(all, rootOrgUnitId);
}

/**
 * Phase 2 + Phase 6: PO list/detail visibility.
 * - Superusers: no extra filter.
 * - Supplier portal users: no filter (caller should still apply supplier workflow rules).
 * - Users with `User.customerCrmAccountId` (customer portal / CT customer scope): only POs whose `customerCrmAccountId` matches (Phase 5 dimension); **AND** with org/division when both are set.
 * - Users with a primary org: only POs where the requester's org is in that subtree, or the requester has no org yet (lenient for legacy data).
 * - Users with product-division links: only POs that have at least one line whose product is in those divisions.
 * - Org + division + customer combine with AND. None of these sets → no extra filter (see all in tenant, same as Phase 1).
 */
export async function getPurchaseOrderScopeWhere(
  tenantId: string,
  actorUserId: string | null,
  options?: { isSupplierPortalUser?: boolean },
): Promise<Prisma.PurchaseOrderWhereInput | undefined> {
  if (!actorUserId) return undefined;
  if (options?.isSupplierPortalUser) return undefined;
  if (await userIsSuperuser(actorUserId)) return undefined;

  const user = await prisma.user.findFirst({
    where: { id: actorUserId, tenantId, isActive: true },
    select: {
      customerCrmAccountId: true,
      primaryOrgUnitId: true,
      productDivisionScope: { select: { productDivisionId: true } },
    },
  });
  if (!user) {
    return { id: { equals: "___no_access___" } } satisfies Prisma.PurchaseOrderWhereInput;
  }

  const customerCrmId = user.customerCrmAccountId?.trim();
  const divIds = user.productDivisionScope.map((s) => s.productDivisionId);
  const orgId = user.primaryOrgUnitId;

  const parts: Prisma.PurchaseOrderWhereInput[] = [];

  if (customerCrmId) {
    parts.push({ customerCrmAccountId: customerCrmId });
  }

  if (orgId) {
    const subtree = await loadOrgUnitSubtreeIds(tenantId, orgId);
    parts.push({
      requester: {
        OR: [
          { primaryOrgUnitId: { in: subtree } },
          { primaryOrgUnitId: null },
        ],
      },
    });
  }

  if (divIds.length > 0) {
    parts.push({
      items: {
        some: {
          product: { divisionId: { in: divIds } },
        },
      },
    });
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0]!;
  return { AND: parts };
}

/** Merge a base `PurchaseOrder` filter with the viewer’s org/division scope (for reports, etc.). */
export async function purchaseOrderWhereWithViewerScope(
  tenantId: string,
  actorUserId: string | null,
  base: Prisma.PurchaseOrderWhereInput,
  options?: { isSupplierPortalUser?: boolean },
): Promise<Prisma.PurchaseOrderWhereInput> {
  const scope = await getPurchaseOrderScopeWhere(tenantId, actorUserId, options);
  if (!scope) return base;
  return { AND: [base, scope] };
}

