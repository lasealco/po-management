import { canActorAccessOrgUnitSubtree } from "@/lib/org-unit-admin-scope";
import { prisma } from "@/lib/prisma";

/** Stored under `UserPreference.key` — JSON: `{ "servedOrgUnitId": string }`. */
export const USER_PREF_ORDERS_SERVED_DEFAULT = "orders.defaultServedOrgUnit_v1";

/** Thrown when the target org is outside the actor’s org subtree (Phase 5/6 scope alignment). */
export class OrdersServedDefaultScopeError extends Error {
  constructor() {
    super("You cannot set a default for that org (outside your scope).");
    this.name = "OrdersServedDefaultScopeError";
  }
}

type PrefBody = { servedOrgUnitId: string };

function parsePrefValue(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = (raw as Record<string, unknown>).servedOrgUnitId;
  if (typeof id !== "string" || !id.trim()) return null;
  return id.trim();
}

export type ServedOrgRef = { id: string; name: string; code: string; kind: string };

export type OrdersServedDefaultResult = {
  defaultOrg: ServedOrgRef | null;
  preferenceUpdatedAt: string | null;
};

/**
 * Load saved default "order for" org for PO/SO create flows. Invalidates stale org ids
 * and preferences outside the user’s org subtree (same rules as `canActorAccessOrgUnitSubtree`).
 */
export async function getOrdersServedDefaultPreference(
  tenantId: string,
  userId: string,
): Promise<OrdersServedDefaultResult> {
  const row = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: USER_PREF_ORDERS_SERVED_DEFAULT } },
    select: { value: true, updatedAt: true },
  });
  if (!row) {
    return { defaultOrg: null, preferenceUpdatedAt: null };
  }
  const orgId = parsePrefValue(row.value);
  if (!orgId) {
    return { defaultOrg: null, preferenceUpdatedAt: row.updatedAt.toISOString() };
  }
  const org = await prisma.orgUnit.findFirst({
    where: { id: orgId, tenantId },
    select: { id: true, name: true, code: true, kind: true },
  });
  if (!org) {
    await prisma.userPreference
      .delete({
        where: { userId_key: { userId, key: USER_PREF_ORDERS_SERVED_DEFAULT } },
      })
      .catch(() => undefined);
    return { defaultOrg: null, preferenceUpdatedAt: null };
  }
  if (!(await canActorAccessOrgUnitSubtree(userId, tenantId, org.id))) {
    await prisma.userPreference
      .delete({
        where: { userId_key: { userId, key: USER_PREF_ORDERS_SERVED_DEFAULT } },
      })
      .catch(() => undefined);
    return { defaultOrg: null, preferenceUpdatedAt: null };
  }
  return {
    defaultOrg: {
      id: org.id,
      name: org.name,
      code: org.code,
      kind: org.kind,
    },
    preferenceUpdatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Set or clear the user’s default; validates org is in-tenant and in the user’s org subtree
 * when a primary org is set. Audit trail: `UserPreference.updatedAt`.
 */
export async function setOrdersServedDefaultPreference(
  tenantId: string,
  userId: string,
  servedOrgUnitId: string | null,
): Promise<OrdersServedDefaultResult> {
  if (servedOrgUnitId == null || servedOrgUnitId.trim() === "") {
    await prisma.userPreference
      .delete({
        where: { userId_key: { userId, key: USER_PREF_ORDERS_SERVED_DEFAULT } },
      })
      .catch(() => undefined);
    return { defaultOrg: null, preferenceUpdatedAt: null };
  }
  const id = servedOrgUnitId.trim();
  const org = await prisma.orgUnit.findFirst({
    where: { id, tenantId },
    select: { id: true, name: true, code: true, kind: true },
  });
  if (!org) {
    throw new Error("Org unit not found in this company.");
  }
  if (!(await canActorAccessOrgUnitSubtree(userId, tenantId, org.id))) {
    throw new OrdersServedDefaultScopeError();
  }
  const value: PrefBody = { servedOrgUnitId: org.id };
  const row = await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: USER_PREF_ORDERS_SERVED_DEFAULT } },
    create: {
      tenantId,
      userId,
      key: USER_PREF_ORDERS_SERVED_DEFAULT,
      value,
    },
    update: { value },
    select: { updatedAt: true },
  });
  return {
    defaultOrg: { id: org.id, name: org.name, code: org.code, kind: org.kind },
    preferenceUpdatedAt: row.updatedAt.toISOString(),
  };
}
