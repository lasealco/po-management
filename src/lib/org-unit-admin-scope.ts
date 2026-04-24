import { userIsSuperuser } from "@/lib/authz";
import { orgUnitSubtreeIds } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";

/**
 * True if the actor may administer this org node (read/write) under org-subtree rules:
 * superuser; or no primary org (tenant-wide); or the node lies under the actor’s primary org.
 */
export async function canActorAccessOrgUnitSubtree(
  actorUserId: string,
  tenantId: string,
  orgUnitId: string,
): Promise<boolean> {
  if (await userIsSuperuser(actorUserId)) return true;
  const actor = await prisma.user.findFirst({
    where: { id: actorUserId, tenantId, isActive: true },
    select: { primaryOrgUnitId: true },
  });
  if (!actor) return false;
  if (!actor.primaryOrgUnitId) return true;
  const rows = await prisma.orgUnit.findMany({
    where: { tenantId },
    select: { id: true, parentId: true },
  });
  return new Set(orgUnitSubtreeIds(rows, actor.primaryOrgUnitId)).has(orgUnitId);
}

/**
 * Top-level (no parent) org nodes: only superuser, or a user with no primary org.
 */
export async function canActorCreateOrReparentToTopLevelOrg(
  actorUserId: string,
  tenantId: string,
): Promise<boolean> {
  if (await userIsSuperuser(actorUserId)) return true;
  const actor = await prisma.user.findFirst({
    where: { id: actorUserId, tenantId, isActive: true },
    select: { primaryOrgUnitId: true },
  });
  if (!actor) return false;
  return !actor.primaryOrgUnitId;
}
