import { apiHubDemoActorMissing, apiHubDemoTenantMissing, apiHubError } from "@/lib/apihub/api-error";
import { getActorUserId, userHasGlobalGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export type ApiHubTenantActorContext = {
  tenant: { id: string; name: string; slug: string };
  actorId: string;
};

/**
 * Demo tenant + demo actor + org.apihub grant (Slice 52 baseline).
 * Health route stays public and does not use this helper.
 */
export async function apiHubEnsureTenantActorGrants(
  requestId: string,
  minAction: "view" | "edit",
): Promise<{ ok: true; ctx: ApiHubTenantActorContext } | { ok: false; response: Response }> {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return { ok: false, response: apiHubDemoTenantMissing(requestId) };
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return { ok: false, response: apiHubDemoActorMissing(requestId) };
  }
  if (!(await userHasGlobalGrant(actorId, "org.apihub", minAction))) {
    return {
      ok: false,
      response: apiHubError(
        403,
        "FORBIDDEN",
        `This action requires org.apihub → ${minAction}. Assign the Integration hub permission in Settings → Roles, or use a Superuser demo account.`,
        requestId,
      ),
    };
  }
  return { ok: true, ctx: { tenant, actorId } };
}
