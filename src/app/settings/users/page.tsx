import { SettingsUsersClient } from "@/components/settings-users-client";
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

  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ isActive: "desc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      userRoles: {
        select: {
          role: {
            select: { id: true, name: true, isSystem: true },
          },
        },
      },
    },
  });

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    roles: u.userRoles.map((ur) => ur.role),
  }));

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Users</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Tenant accounts for this organization. Deactivating a user is
        reversible.
      </p>
      <div className="mt-8">
        <SettingsUsersClient users={rows} />
      </div>
    </div>
  );
}
