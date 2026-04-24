import type { Prisma } from "@prisma/client";

import { userHasGlobalGrant } from "@/lib/authz";
import { crmAccountInScope, getCrmAccessScope } from "@/lib/crm-scope";
import { prisma } from "@/lib/prisma";

/** Non-empty CRM account id the actor may link (org.crm → view + CRM list scope). */
export async function assertOutboundCrmAccountLinkable(
  tenantId: string,
  actorUserId: string,
  crmAccountId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const can = await userHasGlobalGrant(actorUserId, "org.crm", "view");
  if (!can) {
    return {
      ok: false,
      status: 403,
      error: "Linking a CRM account requires org.crm → view.",
    };
  }
  const scope = await getCrmAccessScope(tenantId, actorUserId);
  const where: Prisma.CrmAccountWhereInput = {
    ...crmAccountInScope(tenantId, scope),
    id: crmAccountId,
  };
  const row = await prisma.crmAccount.findFirst({ where, select: { id: true } });
  if (!row) {
    return { ok: false, status: 400, error: "Invalid or inaccessible CRM account." };
  }
  return { ok: true };
}
