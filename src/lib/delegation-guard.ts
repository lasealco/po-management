import {
  loadGlobalGrantsForUser,
  SUPERUSER_ROLE_NAME,
  userIsSuperuser,
} from "@/lib/authz";
import { orgUnitSubtreeIds } from "@/lib/org-scope";
import { prisma } from "@/lib/prisma";

const grantKey = (resource: string, action: string) =>
  `${resource}\0${action}`;

export async function loadGrantKeysForRoleIds(
  tenantId: string,
  roleIds: string[],
): Promise<Set<string>> {
  if (roleIds.length === 0) {
    return new Set();
  }
  const perms = await prisma.rolePermission.findMany({
    where: {
      effect: "allow",
      workflowStatusId: null,
      role: { tenantId, id: { in: roleIds } },
    },
    select: { resource: true, action: true },
  });
  return new Set(perms.map((p) => grantKey(p.resource, p.action)));
}

export type DelegationResult = { ok: true } | { ok: false; error: string };

/**
 * When target is null, only allowed if the actor has no primary org (no “clearing”
 * to tenant-wide from a node-placed admin). When target is set and the actor has
 * an org, the target must lie in the actor’s subtree; when the actor has no org,
 * any valid org in the tenant is allowed (validated by the API).
 */
export function isTargetPrimaryOrgAllowed(
  actorPrimaryOrgUnitId: string | null,
  targetPrimaryOrgUnitId: string | null,
  orgRows: { id: string; parentId: string | null }[],
): boolean {
  if (targetPrimaryOrgUnitId === null) {
    return actorPrimaryOrgUnitId === null;
  }
  if (!actorPrimaryOrgUnitId) {
    return true;
  }
  const subtree = new Set(
    orgUnitSubtreeIds(orgRows, actorPrimaryOrgUnitId),
  );
  return subtree.has(targetPrimaryOrgUnitId);
}

async function hasSuperuserRoleInList(
  tenantId: string,
  roleIds: string[],
): Promise<boolean> {
  if (roleIds.length === 0) {
    return false;
  }
  const n = await prisma.role.count({
    where: {
      tenantId,
      name: SUPERUSER_ROLE_NAME,
      id: { in: roleIds },
    },
  });
  return n > 0;
}

export async function validateUserAdminDelegation(input: {
  actorUserId: string;
  tenantId: string;
  targetRoleIds: string[];
  targetPrimaryOrgUnitId: string | null;
  targetProductDivisionIds: string[];
}): Promise<DelegationResult> {
  const {
    actorUserId,
    tenantId,
    targetRoleIds,
    targetPrimaryOrgUnitId,
    targetProductDivisionIds,
  } = input;

  if (await userIsSuperuser(actorUserId)) {
    return { ok: true };
  }

  if (await hasSuperuserRoleInList(tenantId, targetRoleIds)) {
    return {
      ok: false,
      error:
        "Only a superuser can assign the Superuser role. Remove it from the role list or ask a superuser.",
    };
  }

  const [actorGrants, roleGrantKeys] = await Promise.all([
    loadGlobalGrantsForUser(actorUserId),
    loadGrantKeysForRoleIds(tenantId, targetRoleIds),
  ]);

  for (const k of roleGrantKeys) {
    if (!actorGrants.has(k)) {
      return {
        ok: false,
        error:
          "You cannot assign a role whose permissions exceed your own. Remove elevated roles or ask a superuser.",
      };
    }
  }

  const actor = await prisma.user.findFirst({
    where: { id: actorUserId, tenantId, isActive: true },
    select: {
      primaryOrgUnitId: true,
      productDivisionScope: { select: { productDivisionId: true } },
    },
  });
  if (!actor) {
    return { ok: false, error: "Actor user not found or is inactive." };
  }

  const orgRows = await prisma.orgUnit.findMany({
    where: { tenantId },
    select: { id: true, parentId: true },
  });

  if (
    !isTargetPrimaryOrgAllowed(
      actor.primaryOrgUnitId,
      targetPrimaryOrgUnitId,
      orgRows,
    )
  ) {
    if (actor.primaryOrgUnitId && targetPrimaryOrgUnitId === null) {
      return {
        ok: false,
        error:
          "You cannot clear another user’s primary org when your own org is set. Ask a superuser if this change is required.",
      };
    }
    return {
      ok: false,
      error:
        "You can only assign a primary org at or below your own org in the hierarchy.",
    };
  }

  const actorDivs = new Set(
    actor.productDivisionScope.map((s) => s.productDivisionId),
  );
  if (actorDivs.size > 0) {
    for (const d of targetProductDivisionIds) {
      if (!actorDivs.has(d)) {
        return {
          ok: false,
          error:
            "You cannot assign product divisions outside your own division scope.",
        };
      }
    }
  }

  return { ok: true };
}

export async function validateRolePermissionGrants(
  actorUserId: string,
  role: { name: string },
  grants: { resource: string; action: string }[],
): Promise<DelegationResult> {
  if (await userIsSuperuser(actorUserId)) {
    return { ok: true };
  }
  if (role.name === SUPERUSER_ROLE_NAME) {
    return {
      ok: false,
      error: "Only a superuser can edit the Superuser role’s permissions.",
    };
  }
  const actorGrants = await loadGlobalGrantsForUser(actorUserId);
  for (const g of grants) {
    if (!actorGrants.has(grantKey(g.resource, g.action))) {
      return {
        ok: false,
        error: "You cannot add permissions to this role that you do not hold yourself.",
      };
    }
  }
  return { ok: true };
}
