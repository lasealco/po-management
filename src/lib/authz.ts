import { cache } from "react";
import { NextResponse } from "next/server";

import { getDemoActorEmail } from "@/lib/demo-actor";
import { getDemoTenant } from "@/lib/demo-tenant";
import { GLOBAL_PERMISSION_CATALOG } from "@/lib/permission-catalog";
import { prisma } from "@/lib/prisma";

const grantKey = (resource: string, action: string) =>
  `${resource}\0${action}`;

/** Seeded system role: full global permissions + bypasses supplier/customer portal scoping. */
export const SUPERUSER_ROLE_NAME = "Superuser";

function allSuperuserGrantKeys(): string[] {
  return [
    ...GLOBAL_PERMISSION_CATALOG.map((r) => grantKey(r.resource, r.action)),
    grantKey("org.suppliers", "approve"),
  ];
}

/** Seeded internal demo accounts; some prod DBs predate CRM/WMS RolePermission rows. */
const DEMO_INTERNAL_EMAILS = new Set([
  "buyer@demo-company.com",
  "approver@demo-company.com",
]);

/**
 * Align grants with `prisma/seed.mjs` for Buyer/Approver when the DB was created before
 * CRM or WMS permissions existed, or rows were missing after a partial migrate.
 */
function mergeDemoLegacyGrants(
  grantSet: Set<string>,
  email: string,
): Set<string> {
  const e = email.trim().toLowerCase();
  if (!DEMO_INTERNAL_EMAILS.has(e)) return grantSet;

  let next: Set<string> | null = null;
  const ensure = (resource: string, action: string) => {
    const k = grantKey(resource, action);
    const active = next ?? grantSet;
    if (active.has(k)) return;
    if (!next) next = new Set(grantSet);
    next.add(k);
  };

  if (!grantSet.has(grantKey("org.crm", "view"))) {
    ensure("org.crm", "view");
    ensure("org.crm", "edit");
  }
  if (!grantSet.has(grantKey("org.wms", "view"))) {
    ensure("org.wms", "view");
    ensure("org.wms", "edit");
  }

  if (e === "buyer@demo-company.com" && !grantSet.has(grantKey("org.suppliers", "edit"))) {
    ensure("org.suppliers", "edit");
  }
  if (e === "approver@demo-company.com" && !grantSet.has(grantKey("org.suppliers", "approve"))) {
    ensure("org.suppliers", "approve");
  }

  if (!grantSet.has(grantKey("org.apihub", "view"))) {
    ensure("org.apihub", "view");
    ensure("org.apihub", "edit");
  }

  if (!grantSet.has(grantKey("org.scri", "view"))) {
    ensure("org.scri", "view");
    ensure("org.scri", "edit");
  }

  for (const res of [
    "org.wms.setup",
    "org.wms.operations",
    "org.wms.inventory",
    "org.wms.inventory.lot",
    "org.wms.inventory.serial",
  ] as const) {
    ensure(res, "view");
    ensure(res, "edit");
  }

  return next ?? grantSet;
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

/** True when the user has the seeded Superuser role (full app + no portal-style restrictions). */
export const userIsSuperuser = cache(async (userId: string): Promise<boolean> => {
  const row = await prisma.userRole.findFirst({
    where: { userId, role: { name: SUPERUSER_ROLE_NAME } },
    select: { id: true },
  });
  return Boolean(row);
});

/**
 * Supplier portal users are scoped to supplier workflows; superusers are never treated as portal-restricted
 * even if they also carry other roles in a test database.
 */
export const actorIsSupplierPortalRestricted = cache(async (actorUserId: string): Promise<boolean> => {
  if (await userIsSuperuser(actorUserId)) return false;
  return userHasRoleNamed(actorUserId, "Supplier portal");
});

/**
 * True when the user is **CRM-customer–scoped** (`User.customerCrmAccountId` set), e.g. customer
 * portal / Control Tower “customer” view. Superusers are never treated as customer-scoped.
 */
export const actorIsCustomerCrmScoped = cache(async (actorUserId: string): Promise<boolean> => {
  if (await userIsSuperuser(actorUserId)) return false;
  const row = await prisma.user.findFirst({
    where: { id: actorUserId, isActive: true },
    select: { customerCrmAccountId: true },
  });
  return Boolean(row?.customerCrmAccountId);
});

export async function loadGlobalGrantsForUser(userId: string) {
  const [perms, user, isSuperuser] = await Promise.all([
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
    userIsSuperuser(userId),
  ]);
  const base = new Set(perms.map((p) => grantKey(p.resource, p.action)));
  let merged = !user?.email ? base : mergeDemoLegacyGrants(base, user.email);
  if (isSuperuser) {
    const next = new Set(merged);
    for (const k of allSuperuserGrantKeys()) next.add(k);
    merged = next;
  }
  return merged;
}

export async function userHasGlobalGrant(
  userId: string,
  resource: string,
  action: string,
) {
  const set = await loadGlobalGrantsForUser(userId);
  return set.has(grantKey(resource, action));
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
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
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

/** BF-49 — timeline-style feeds shared across CT + WMS; viewer needs at least one lane. */
export async function requireAnyApiGrant(
  pairs: readonly { resource: string; action: string }[],
): Promise<NextResponse | null> {
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
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
  }

  const set = await loadGlobalGrantsForUser(user.id);
  const ok = pairs.some((p) => set.has(grantKey(p.resource, p.action)));
  if (!ok) {
    const need = pairs.map((p) => `${p.resource} → ${p.action}`).join(" or ");
    return NextResponse.json(
      {
        error: `Forbidden: requires ${need}`,
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

/** True when the viewer can perform any WMS mutation (legacy `org.wms` edit or a BF-06 scoped edit). */
export function viewerHasAnyWmsMutationEdit(grantSet: Set<string>): boolean {
  return (
    viewerHas(grantSet, "org.wms", "edit") ||
    viewerHas(grantSet, "org.wms.setup", "edit") ||
    viewerHas(grantSet, "org.wms.operations", "edit") ||
    viewerHas(grantSet, "org.wms.inventory", "edit") ||
    viewerHas(grantSet, "org.wms.inventory.lot", "edit") ||
    viewerHas(grantSet, "org.wms.inventory.serial", "edit")
  );
}

/**
 * BF-06 + BF-16 — Stock workspace: qty-path inventory mutations (holds, cycle count on ops page, serial registry,
 * saved ledger views API tier uses `org.wms.inventory` via `gateWmsTierMutation`).
 */
export function viewerHasWmsInventoryQtyMutationEdit(grantSet: Set<string>): boolean {
  return viewerHas(grantSet, "org.wms", "edit") || viewerHas(grantSet, "org.wms.inventory", "edit");
}

/** BF-16 — `set_wms_lot_batch` and Stock UI lot-master panel. */
export function viewerHasWmsInventoryLotMutationEdit(grantSet: Set<string>): boolean {
  return (
    viewerHas(grantSet, "org.wms", "edit") ||
    viewerHas(grantSet, "org.wms.inventory", "edit") ||
    viewerHas(grantSet, "org.wms.inventory.lot", "edit")
  );
}

/** BF-48 — serialization registry POST actions + Stock UI serial mutation shell. */
export function viewerHasWmsInventorySerialMutationEdit(grantSet: Set<string>): boolean {
  return (
    viewerHas(grantSet, "org.wms", "edit") ||
    viewerHas(grantSet, "org.wms.inventory", "edit") ||
    viewerHas(grantSet, "org.wms.inventory.serial", "edit")
  );
}

/**
 * BF-06 — Section workspace edit: legacy `org.wms` edit or scoped tier edit.
 * BF-16 — Stock (`inventory`) also accepts `org.wms.inventory.lot → edit` for partial mutation shells.
 * BF-48 — Stock also accepts `org.wms.inventory.serial → edit` for serialization registry shells.
 */
export function viewerHasWmsSectionMutationEdit(
  grantSet: Set<string>,
  section: "setup" | "operations" | "inventory",
): boolean {
  if (viewerHas(grantSet, "org.wms", "edit")) return true;
  if (section === "inventory") {
    return (
      viewerHas(grantSet, "org.wms.inventory", "edit") ||
      viewerHas(grantSet, "org.wms.inventory.lot", "edit") ||
      viewerHas(grantSet, "org.wms.inventory.serial", "edit")
    );
  }
  return viewerHas(grantSet, `org.wms.${section}`, "edit");
}
