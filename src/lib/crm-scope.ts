import { userHasGlobalGrant } from "@/lib/authz";

/** CRM list scope: reps see own records; users with org.crm → edit see full tenant. */
export async function crmTenantFilter(
  tenantId: string,
  actorUserId: string,
): Promise<{ tenantId: string; ownerUserId?: string }> {
  const seeAll = await userHasGlobalGrant(actorUserId, "org.crm", "edit");
  if (seeAll) return { tenantId };
  return { tenantId, ownerUserId: actorUserId };
}
