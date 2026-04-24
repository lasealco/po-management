import { SettingsUsersClient } from "@/components/settings-users-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsUsersPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  const [users, roleCatalog, orgUnits, productDivisionCatalog] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ isActive: "desc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        primaryOrgUnitId: true,
        primaryOrgUnit: {
          select: { id: true, name: true, code: true, kind: true },
        },
        productDivisionScope: {
          select: { productDivision: { select: { id: true, name: true, code: true } } },
        },
        userRoles: {
          select: {
            role: {
              select: { id: true, name: true, isSystem: true },
            },
          },
        },
      },
    }),
    prisma.role.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isSystem: true },
    }),
    prisma.orgUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, kind: true },
    }),
    prisma.productDivision.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
  ]);

  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.settings", "edit"),
  );
  const actorUserId = access?.user?.id ?? null;

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    primaryOrgUnitId: u.primaryOrgUnitId,
    primaryOrgUnit: u.primaryOrgUnit,
    productDivisions: u.productDivisionScope.map((p) => p.productDivision),
    roles: u.userRoles.map((ur) => ur.role),
  }));

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Users</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Tenant accounts for this organization. Admins (users with{" "}
        <span className="whitespace-nowrap">org.settings → edit</span>) can create
        users, assign a <strong>primary org</strong> and <strong>product division</strong> scope
        (matrix), roles, reset passwords, and activate or deactivate accounts. Permissions stay
        tenant-wide; org-scoped data rules ship in a later phase. Deactivation is reversible.
      </p>
      <div className="mt-8">
        <SettingsUsersClient
          users={rows}
          roleCatalog={roleCatalog}
          orgUnits={orgUnits}
          productDivisionCatalog={productDivisionCatalog}
          canEdit={canEdit}
          actorUserId={actorUserId}
        />
      </div>
    </div>
  );
}
