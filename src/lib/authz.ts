import { cache } from "react";
import { NextResponse } from "next/server";

import { getDemoActorEmail } from "@/lib/demo-actor";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const grantKey = (resource: string, action: string) =>
  `${resource}\0${action}`;

/** Seeded internal demo accounts; some prod DBs predate CRM RolePermission rows. */
const DEMO_INTERNAL_EMAILS = new Set([
  "buyer@demo-company.com",
  "approver@demo-company.com",
]);

function mergeDemoCrmGrants(
  grantSet: Set<string>,
  email: string,
): Set<string> {
  const e = email.trim().toLowerCase();
  if (!DEMO_INTERNAL_EMAILS.has(e)) return grantSet;
  if (grantSet.has(grantKey("org.crm", "view"))) return grantSet;
  const next = new Set(grantSet);
  next.add(grantKey("org.crm", "view"));
  next.add(grantKey("org.crm", "edit"));
  return next;
}

export async function loadGlobalGrantsForUser(userId: string) {
  const [perms, user] = await Promise.all([
    prisma.rolePermission.findMany({
      where: {
        effect: "allow",
        workflowStatusId: null,
        role: { users: { some: { userId } } },
      },
      select: { resource: true, action: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
  ]);
  const base = new Set(perms.map((p) => grantKey(p.resource, p.action)));
  if (!user?.email) return base;
  return mergeDemoCrmGrants(base, user.email);
}

export async function userHasGlobalGrant(
  userId: string,
  resource: string,
  action: string,
) {
  const set = await loadGlobalGrantsForUser(userId);
  return set.has(grantKey(resource, action));
}

export async function userHasRoleNamed(userId: string, roleName: string) {
  const row = await prisma.userRole.findFirst({
    where: {
      userId,
      role: { name: roleName },
    },
    select: { id: true },
  });
  return Boolean(row);
}

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

async function fetchViewerGrantSet(): Promise<ViewerAccess | null> {
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

/** Deduped per request (layout + nav both read grants). */
export const getViewerGrantSet = cache(fetchViewerGrantSet);

export function viewerHas(
  grantSet: Set<string>,
  resource: string,
  action: string,
) {
  return grantSet.has(grantKey(resource, action));
}
