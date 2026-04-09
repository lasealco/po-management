import { NextResponse } from "next/server";

import { getDemoActorEmail } from "@/lib/demo-actor";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function loadGlobalGrantsForUser(userId: string) {
  const perms = await prisma.rolePermission.findMany({
    where: {
      effect: "allow",
      workflowStatusId: null,
      role: { users: { some: { userId } } },
    },
    select: { resource: true, action: true },
  });
  return new Set(perms.map((p) => `${p.resource}\0${p.action}`));
}

export async function userHasGlobalGrant(
  userId: string,
  resource: string,
  action: string,
) {
  const set = await loadGlobalGrantsForUser(userId);
  return set.has(`${resource}\0${action}`);
}

const grantKey = (resource: string, action: string) =>
  `${resource}\0${action}`;

export async function requireApiGrant(resource: string, action: string) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const email = await getDemoActorEmail();
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email, isActive: true },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "No active demo user for this session. Choose a user in the header bar.",
      },
      { status: 403 },
    );
  }

  if (!(await userHasGlobalGrant(user.id, resource, action))) {
    return NextResponse.json(
      {
        error: `Forbidden: requires permission ${resource} → ${action}`,
      },
      { status: 403 },
    );
  }

  return null;
}

/** Active demo user id in tenant, or null (no cookie user / inactive). */
export async function getActorUserId(): Promise<string | null> {
  const tenant = await getDemoTenant();
  if (!tenant) return null;
  const email = await getDemoActorEmail();
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email, isActive: true },
    select: { id: true },
  });
  return user?.id ?? null;
}

export type ViewerAccess = {
  tenant: { id: string; name: string; slug: string };
  user: { id: string; email: string; name: string } | null;
  grantSet: Set<string>;
};

export async function getViewerGrantSet(): Promise<ViewerAccess | null> {
  const tenant = await getDemoTenant();
  if (!tenant) return null;

  const email = await getDemoActorEmail();
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email, isActive: true },
    select: { id: true, email: true, name: true },
  });

  const base = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  };

  if (!user) {
    return { ...base, user: null, grantSet: new Set() };
  }

  const grantSet = await loadGlobalGrantsForUser(user.id);
  return { ...base, user, grantSet };
}

export function viewerHas(
  grantSet: Set<string>,
  resource: string,
  action: string,
) {
  return grantSet.has(grantKey(resource, action));
}
