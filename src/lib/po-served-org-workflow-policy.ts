import { userIsSuperuser } from "@/lib/authz";
import type { OrgUnitOperatingRole } from "@prisma/client";

import { loadOrgUnitSubtreeIds } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";

/** Release spend for a served org that is not the actor’s own node (Phase 4). */
const CROSS_SERVED_ROLES: ReadonlySet<OrgUnitOperatingRole> = new Set([
  "GROUP_PROCUREMENT",
  "REGIONAL_HQ",
]);

export type PoServedSendPolicyResult = { ok: true } | { ok: false; error: string };

/**
 * `send_to_supplier` (draft → sent): when `servedOrgUnitId` is set, require the actor’s
 * primary org to **cover** the served node, and (unless served equals primary) an operating
 * role that can release for other nodes. Superusers bypass.
 */
export async function assertSendToSupplierServedOrgPolicy(
  tenantId: string,
  actorUserId: string,
  servedOrgUnitId: string | null,
): Promise<PoServedSendPolicyResult> {
  if (!servedOrgUnitId) return { ok: true };
  if (await userIsSuperuser(actorUserId)) return { ok: true };

  const user = await prisma.user.findFirst({
    where: { id: actorUserId, tenantId, isActive: true },
    select: { primaryOrgUnitId: true },
  });
  if (!user) {
    return { ok: false, error: "User not found for this company." };
  }
  if (!user.primaryOrgUnitId) {
    return {
      ok: false,
      error:
        "A primary org is required to send a purchase order that specifies an “order for” org. Ask an admin to set your org, or clear the “order for” field.",
    };
  }

  const subtree = await loadOrgUnitSubtreeIds(tenantId, user.primaryOrgUnitId);
  if (!subtree.includes(servedOrgUnitId)) {
    return {
      ok: false,
      error:
        "The “order for” org must be within your org hierarchy. Your primary org does not cover this site for supplier release.",
    };
  }
  if (servedOrgUnitId === user.primaryOrgUnitId) {
    return { ok: true };
  }

  const roleRows = await prisma.orgUnitRoleAssignment.findMany({
    where: { orgUnitId: user.primaryOrgUnitId },
    select: { role: true },
  });
  const roles = new Set(roleRows.map((r) => r.role));
  for (const r of CROSS_SERVED_ROLES) {
    if (roles.has(r)) return { ok: true };
  }
  return {
    ok: false,
    error:
      "Releasing to the supplier for another org unit requires a Regional HQ or Group procurement operating role on your primary org (Settings → Org & sites).",
  };
}
